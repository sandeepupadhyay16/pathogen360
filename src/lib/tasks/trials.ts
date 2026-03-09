import { prisma } from '@/lib/prisma';
import { runInContext } from '@/lib/operations';

const CT_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseDate(str: string | null | undefined): Date | null {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function extractPhase(phases: string[] | null | undefined): string | null {
    if (!phases || phases.length === 0) return null;
    const map: Record<string, string> = {
        PHASE1: 'Phase 1', PHASE2: 'Phase 2', PHASE3: 'Phase 3', PHASE4: 'Phase 4',
        EARLY_PHASE1: 'Early Phase 1', NA: 'N/A',
    };
    return phases.map(p => map[p] || p).join(', ');
}

function isVaccine(interventions: any[]): boolean {
    if (!interventions) return false;
    return interventions.some((i: any) => {
        const name = (i.name || '').toLowerCase();
        const type = (i.type || '').toUpperCase();
        return type === 'BIOLOGICAL' || name.includes('vaccine') || name.includes('immuniz') ||
            name.includes('mrna') || name.includes('vector') || name.includes('toxoid');
    });
}

function formatOutcomes(outcomes: any[] | null | undefined): string | null {
    if (!outcomes || outcomes.length === 0) return null;
    return outcomes.map((o: any) => {
        const measure = o.measure || '';
        const timeFrame = o.timeFrame ? ` (${o.timeFrame})` : '';
        const desc = o.description ? `: ${o.description}` : '';
        return `${measure}${timeFrame}${desc}`;
    }).join(' | ');
}

async function fetchTrials(pathogenName: string, limit: number = 50): Promise<any[]> {
    const url = new URL(CT_API_BASE);
    url.searchParams.set('query.cond', pathogenName);
    url.searchParams.set('pageSize', limit.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('fields', [
        'NCTId', 'BriefTitle', 'OfficialTitle', 'Phase', 'OverallStatus',
        'BriefSummary', 'DetailedDescription', 'EligibilityCriteria',
        'EnrollmentCount', 'EnrollmentType', 'LeadSponsorName', 'CollaboratorName',
        'Condition', 'InterventionType', 'InterventionName', 'InterventionDescription',
        'PrimaryOutcomeMeasure', 'PrimaryOutcomeTimeFrame', 'PrimaryOutcomeDescription',
        'SecondaryOutcomeMeasure', 'SecondaryOutcomeTimeFrame', 'SecondaryOutcomeDescription',
        'StudyType', 'DesignAllocation', 'DesignInterventionModel', 'DesignPrimaryPurpose', 'DesignMaskingInfo',
        'StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'LocationCountry'
    ].join(','));

    const response = await fetch(url.toString());
    if (response.status === 429) { await sleep(5000); return fetchTrials(pathogenName); }
    if (!response.ok) throw new Error(`CT API ${response.status}`);
    const data = await response.json();

    return (data.studies || []).map((study: any) => {
        const proto = study.protocolSection || {};
        const design = proto.designModule || {};
        const interventions = proto.armsInterventionsModule?.interventions || [];
        const sponsors = proto.sponsorCollaboratorsModule || {};
        const descMod = proto.descriptionModule || {};
        const status = proto.statusModule || {};

        const designParts: string[] = [];
        if (design.studyType) designParts.push(`Type: ${design.studyType}`);

        return {
            nctId: proto.identificationModule?.nctId || '',
            title: proto.identificationModule?.briefTitle || '',
            phase: extractPhase(design.phases),
            status: status.overallStatus || null,
            overallStatus: status.overallStatus || null,
            isVaccine: isVaccine(interventions),
            sponsor: sponsors.leadSponsor?.name || null,
            description: descMod.briefSummary || null,
            enrollment: design.enrollmentInfo?.count || null,
            studyDesign: designParts.join(', '),
            startDate: parseDate(status.startDateStruct?.date),
        };
    });
}

export async function syncTrialsForPathogen(pathogen: { id: string, name: string }, ctx: any, limit: number = 50) {
    try {
        const trials = await fetchTrials(pathogen.name, limit);
        let saved = 0;
        for (const trial of trials) {
            try {
                await (prisma as any).clinicalTrial.upsert({
                    where: { nctId: trial.nctId },
                    update: { ...trial, pathogenId: pathogen.id },
                    create: { ...trial, pathogenId: pathogen.id },
                });
                saved++;
            } catch { }
        }
        await ctx.log(`✓ ${pathogen.name}: ${saved} trials updated.`);
        return saved;
    } catch (err: any) {
        await ctx.log(`✗ ${pathogen.name} trials failed: ${err.message}`, 'WARN');
        throw err;
    }
}

export async function executeTrialsTask(opId: string, params: any) {
    const { pathogenId } = params;

    await runInContext(opId, async (ctx) => {
        const targets = pathogenId
            ? await prisma.pathogen.findMany({ where: { id: pathogenId }, select: { id: true, name: true } })
            : await prisma.pathogen.findMany({ select: { id: true, name: true } });

        await ctx.log(`Refreshing clinical trials for ${targets.length} pathogens...`);

        for (let i = 0; i < targets.length; i++) {
            const pathogen = targets[i];
            await ctx.progress(Math.floor((i / targets.length) * 100), `Syncing trials for ${pathogen.name}`);
            await syncTrialsForPathogen(pathogen, ctx);
            if (targets.length > 1) await sleep(500); // Throttling
        }
    });
}
