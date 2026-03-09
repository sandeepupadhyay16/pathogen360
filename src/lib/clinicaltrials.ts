/**
 * ClinicalTrials.gov API v2 Integration
 * Searches for clinical trials for a given pathogen/condition and returns structured data.
 * Now captures expanded fields: descriptions, eligibility, outcomes, enrollment, and study design.
 * API Docs: https://clinicaltrials.gov/data-api/api
 */

const CT_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';

export interface ClinicalTrialData {
    nctId: string;
    title: string;
    phase: string | null;
    status: string | null;
    overallStatus: string | null;
    interventionType: string | null;
    isVaccine: boolean;
    sponsor: string | null;
    collaborators: string | null;
    conditions: string | null;
    locations: string | null;
    description: string | null;
    eligibilityCriteria: string | null;
    enrollment: number | null;
    studyDesign: string | null;
    primaryOutcomes: string | null;
    secondaryOutcomes: string | null;
    interventionDetails: string | null;
    resultsPosted: boolean;
    startDate: Date | null;
    primaryCompletionDate: Date | null;
    completionDate: Date | null;
}

function parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

function extractPhase(phases: string[] | null | undefined): string | null {
    if (!phases || phases.length === 0) return null;
    const phaseMap: Record<string, string> = {
        'PHASE1': 'Phase 1',
        'PHASE2': 'Phase 2',
        'PHASE3': 'Phase 3',
        'PHASE4': 'Phase 4',
        'EARLY_PHASE1': 'Early Phase 1',
        'NA': 'N/A',
    };
    return phases.map(p => phaseMap[p] || p).join(', ');
}

function isVaccineIntervention(interventions: any[]): boolean {
    if (!interventions) return false;
    return interventions.some(i => {
        const name = (i.name || '').toLowerCase();
        const type = (i.type || '').toUpperCase();
        return (
            type === 'BIOLOGICAL' ||
            name.includes('vaccine') ||
            name.includes('immuniz') ||
            name.includes('mRNA') ||
            name.includes('vector')
        );
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

function formatInterventions(interventions: any[]): string | null {
    if (!interventions || interventions.length === 0) return null;
    return interventions.map((i: any) => {
        const type = i.type ? `[${i.type}]` : '';
        const name = i.name || 'Unknown';
        const desc = i.description ? `: ${i.description}` : '';
        return `${type} ${name}${desc}`;
    }).join(' | ');
}

function formatStudyDesign(design: any): string | null {
    if (!design) return null;
    const parts: string[] = [];
    if (design.studyType) parts.push(`Type: ${design.studyType}`);
    if (design.phases?.length) parts.push(`Phase: ${design.phases.join(', ')}`);
    if (design.allocation) parts.push(`Allocation: ${design.allocation}`);
    if (design.interventionModel) parts.push(`Model: ${design.interventionModel}`);
    if (design.primaryPurpose) parts.push(`Purpose: ${design.primaryPurpose}`);
    if (design.maskingInfo?.masking) parts.push(`Masking: ${design.maskingInfo.masking}`);
    return parts.length > 0 ? parts.join(', ') : null;
}

export async function searchClinicalTrials(pathogenName: string, maxResults = 50): Promise<ClinicalTrialData[]> {
    const url = new URL(CT_API_BASE);
    url.searchParams.set('query.cond', pathogenName);
    url.searchParams.set('query.term', `${pathogenName} vaccine OR treatment OR therapy`);
    url.searchParams.set('pageSize', String(Math.min(maxResults, 100)));
    url.searchParams.set('format', 'json');
    // Request expanded fields including descriptions, eligibility, outcomes, and design
    url.searchParams.set('fields', [
        'NCTId', 'BriefTitle', 'OfficialTitle', 'Phase', 'OverallStatus',
        'BriefSummary', 'DetailedDescription', 'EligibilityCriteria',
        'EnrollmentCount', 'EnrollmentType',
        'LeadSponsorName', 'CollaboratorName',
        'Condition', 'InterventionType', 'InterventionName', 'InterventionDescription',
        'PrimaryOutcomeMeasure', 'PrimaryOutcomeTimeFrame', 'PrimaryOutcomeDescription',
        'SecondaryOutcomeMeasure', 'SecondaryOutcomeTimeFrame', 'SecondaryOutcomeDescription',
        'StudyType', 'DesignAllocation', 'DesignInterventionModel', 'DesignPrimaryPurpose', 'DesignMaskingInfo',
        'StartDate', 'PrimaryCompletionDate', 'CompletionDate',
        'ResultsFirstPostDate', 'LocationCountry'
    ].join(','));

    const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Pathogen360/1.0 (research tool)' }
    });

    if (!response.ok) {
        throw new Error(`ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const studies = data.studies || [];

    return studies.map((study: any): ClinicalTrialData => {
        const proto = study.protocolSection || {};
        const id = proto.identificationModule || {};
        const statusMod = proto.statusModule || {};
        const design = proto.designModule || {};
        const interventions = proto.armsInterventionsModule?.interventions || [];
        const sponsors = proto.sponsorCollaboratorsModule || {};
        const conditions = proto.conditionsModule?.conditions || [];
        const descMod = proto.descriptionModule || {};
        const eligMod = proto.eligibilityModule || {};
        const outcomesMod = proto.outcomesModule || {};
        const contactsLoc = proto.contactsLocationsModule || {};
        const resultsSection = study.resultsSection;

        // Extract locations/countries
        const locationCountries = contactsLoc.locations?.map((l: any) => l.country).filter(Boolean) || [];
        const uniqueCountries = [...new Set(locationCountries)];

        // Determine the primary intervention type
        const types: string[] = interventions.map((i: any) => i.type).filter(Boolean);
        const primaryType = types[0] || null;

        // Collaborators
        const collabs = sponsors.collaborators?.map((c: any) => c.name).filter(Boolean) || [];

        // Study design
        const designStr = formatStudyDesign(design);

        // Description: prefer detailed, fall back to brief summary
        const description = descMod.detailedDescription || descMod.briefSummary || null;

        // Enrollment
        const enrollment = proto.designModule?.enrollmentInfo?.count || null;

        return {
            nctId: id.nctId || '',
            title: id.briefTitle || id.officialTitle || '',
            phase: extractPhase(design.phases),
            status: statusMod.overallStatus || null,
            overallStatus: statusMod.overallStatus || null,
            interventionType: primaryType,
            isVaccine: isVaccineIntervention(interventions),
            sponsor: sponsors.leadSponsor?.name || null,
            collaborators: collabs.length > 0 ? collabs.join(', ') : null,
            conditions: conditions.join(', ') || null,
            locations: uniqueCountries.join(', ') || null,
            description,
            eligibilityCriteria: eligMod.eligibilityCriteria || null,
            enrollment,
            studyDesign: designStr,
            primaryOutcomes: formatOutcomes(outcomesMod.primaryOutcomes),
            secondaryOutcomes: formatOutcomes(outcomesMod.secondaryOutcomes),
            interventionDetails: formatInterventions(interventions),
            resultsPosted: !!resultsSection,
            startDate: parseDate(statusMod.startDateStruct?.date),
            primaryCompletionDate: parseDate(statusMod.primaryCompletionDateStruct?.date),
            completionDate: parseDate(statusMod.completionDateStruct?.date),
        };
    }).filter((t: ClinicalTrialData) => t.nctId); // Filter out any with no NCT ID
}

export function formatClinicalTrialsContext(pathogenName: string, trials: any[]): { context: string, sources: any[], visuals: any } {
    if (!trials || trials.length === 0) {
        return { context: '', sources: [], visuals: null };
    }

    const sources: any[] = [];
    const rawPhaseMap: Record<string, number> = {};
    let vaccineCount = 0;
    let activeCount = 0;
    const lateStageVaccines: string[] = [];

    // Normalization map for phases
    const normalizePhase = (phase: string | null): string => {
        if (!phase || phase === 'null') return 'Unknown';
        if (phase.includes('Phase 1') && phase.includes('Phase 2')) return 'Phase 1/2';
        if (phase.includes('Phase 2') && phase.includes('Phase 3')) return 'Phase 2/3';
        return phase;
    };

    for (const t of trials) {
        const phase = normalizePhase(t.phase);
        rawPhaseMap[phase] = (rawPhaseMap[phase] || 0) + 1;
        if (t.isVaccine) vaccineCount++;
        const s = (t.overallStatus || '').toUpperCase();
        if (['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'].includes(s)) activeCount++;
        if (t.isVaccine && t.phase && (t.phase.includes('Phase 2') || t.phase.includes('Phase 3') || t.phase.includes('Phase 4'))) {
            lateStageVaccines.push(`${t.title} (${t.phase}, ${t.overallStatus}, Sponsor: ${t.sponsor || 'Unknown'}, Enrollment: ${t.enrollment || 'N/A'})`);
        }
    }

    const phaseBreakdown = Object.entries(rawPhaseMap).map(([k, v]) => `${k}: ${v}`).join(', ');

    // Status breakdown
    const statusMap: Record<string, number> = {};
    trials.forEach(t => {
        const s = t.overallStatus || 'Unknown';
        statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const statusBreakdown = Object.entries(statusMap).map(([k, v]) => `${k}: ${v}`).join(', ');

    const vaccineHorizon = lateStageVaccines.length > 0
        ? `YES — ${lateStageVaccines.length} late-stage vaccine trial(s): ${lateStageVaccines.slice(0, 3).join('; ')}`
        : (vaccineCount > 0 ? `EARLY STAGE — ${vaccineCount} early-stage vaccine trial(s) active` : 'NO vaccine trials found');

    const topTrials = trials.slice(0, 50).map((t: any) => {
        let entry = `- [Trial: ${t.nctId}] ${t.title}\n  Phase: ${t.phase || 'N/A'} | Status: ${t.overallStatus || 'N/A'} | Vaccine: ${t.isVaccine ? 'Yes' : 'No'} | Sponsor: ${t.sponsor || 'N/A'} | Enrollment: ${t.enrollment || 'N/A'} | Start: ${t.startDate ? new Date(t.startDate).toLocaleDateString() : 'N/A'}`;
        if (t.description) entry += `\n  Description: ${t.description.substring(0, 300)}${t.description.length > 300 ? '...' : ''}`;
        if (t.primaryOutcomes) entry += `\n  Primary Outcomes: ${t.primaryOutcomes.substring(0, 200)}${t.primaryOutcomes.length > 200 ? '...' : ''}`;
        if (t.interventionDetails) entry += `\n  Interventions: ${t.interventionDetails.substring(0, 200)}${t.interventionDetails.length > 200 ? '...' : ''}`;
        return entry;
    }).join('\n');

    const context = `
[CLINICAL TRIALS DATA — sourced from ClinicalTrials.gov]
Pathogen: ${pathogenName}
Total Trials Records in DB: ${trials.length}
Currently Active Trials: ${activeCount}
Vaccine Trials: ${vaccineCount}
Phase Breakdown: ${phaseBreakdown}
Status Breakdown: ${statusBreakdown}
Vaccine on Horizon: ${vaccineHorizon}

Detailed Trial Listings (most recent 50):
${topTrials}
[End of Clinical Trials Data]`;

    sources.push({
        id: 'clinicaltrials-gov',
        type: 'clinical_trials',
        title: `ClinicalTrials.gov — ${trials.length} trials for ${pathogenName}`,
        date: new Date()
    });

    trials.slice(0, 100).forEach((t: any) => {
        sources.push({
            id: t.nctId,
            type: 'clinical_trial',
            title: t.title,
            date: t.startDate
        });
    });

    // Structured data for visuals with normalization and summary text
    const trialPhases = Object.entries(rawPhaseMap).map(([name, value]) => ({ name, value }));

    const visuals = {
        trialPhases,
        trialStats: [
            { name: 'Active', value: activeCount },
            { name: 'Completed/Other', value: trials.length - activeCount }
        ],
        vaccineStats: [
            { name: 'Vaccine', value: vaccineCount },
            { name: 'Other Interventions', value: trials.length - vaccineCount }
        ],
        summaryText: `${pathogenName} has ${trials.length} total trial records, with ${activeCount} currently active. The pipeline is heavily focused on ${vaccineCount} vaccine-related studies, with a significant distribution in ${phaseBreakdown}.`,
        tables: {
            phaseDistribution: trialPhases.map(p => ({ "Phase": p.name, "Count": p.value })),
            trialActivity: [
                { "Status": "Active", "Count": activeCount },
                { "Status": "Completed/Other", "Count": trials.length - activeCount }
            ]
        }
    };

    return { context, sources, visuals };
}
