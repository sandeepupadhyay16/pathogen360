import { prisma } from '@/lib/prisma';
import { runInContext } from '@/lib/operations';
import { fetchWithRetry, sleep } from '@/lib/utils';

const CT_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';

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

async function fetchTrials(medicalTerm: string, limit: number = 50): Promise<any[]> {
    const url = new URL(CT_API_BASE);
    url.searchParams.set('query.cond', medicalTerm);
    url.searchParams.set('pageSize', limit.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('format', 'json');
    // Request everything (default) to avoid 400 errors on invalid field names

    const response = await fetchWithRetry(url.toString());
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
            sponsor: sponsors.leadSponsor?.name || null,
            description: descMod.briefSummary || null,
            enrollment: design.enrollmentInfo?.count || null,
            studyDesign: designParts.join(', '),
            startDate: parseDate(status.startDateStruct?.date),
            interventionDetails: interventions.map((i: any) => `${i.type}: ${i.name}`).join(' | '),
        };
    });
}

export async function syncTrialsForMedicalTerm(medicalTerm: { id: string, name: string }, ctx: any, limit: number = 50) {
    try {
        const trials = await fetchTrials(medicalTerm.name, limit);
        let saved = 0;
        for (const trial of trials) {
            try {
                await prisma.clinicalTrial.upsert({
                    where: { nctId: trial.nctId },
                    update: { ...trial, medicalTermId: medicalTerm.id },
                    create: { ...trial, medicalTermId: medicalTerm.id },
                });
                saved++;
            } catch { }
        }
        await ctx.log(`✓ ${medicalTerm.name}: ${saved} trials updated.`);
        return saved;
    } catch (err: any) {
        await ctx.log(`✗ ${medicalTerm.name} trials failed: ${err.message}`, 'WARN');
        throw err;
    }
}

export async function executeTrialsTask(opId: string, params: any) {
    const { medicalTermId } = params;

    await runInContext(opId, async (ctx) => {
        const targets = medicalTermId
            ? await prisma.medicalTerm.findMany({ where: { id: medicalTermId }, select: { id: true, name: true } })
            : await prisma.medicalTerm.findMany({ select: { id: true, name: true } });

        await ctx.log(`Refreshing clinical trials for ${targets.length} medical terms...`);

        for (let i = 0; i < targets.length; i++) {
            const term = targets[i];
            await ctx.progress(Math.floor((i / targets.length) * 100), `Syncing trials for ${term.name}`);
            await syncTrialsForMedicalTerm(term, ctx);
            if (targets.length > 1) await sleep(500); // Throttling
        }
    });
}
