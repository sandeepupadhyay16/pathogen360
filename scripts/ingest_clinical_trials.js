/**
 * Ingest Clinical Trials from ClinicalTrials.gov for all pathogens in the DB.
 * Usage: node scripts/ingest_clinical_trials.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CT_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function extractPhase(phases) {
    if (!phases || phases.length === 0) return null;
    const map = {
        PHASE1: 'Phase 1', PHASE2: 'Phase 2', PHASE3: 'Phase 3', PHASE4: 'Phase 4',
        EARLY_PHASE1: 'Early Phase 1', NA: 'N/A',
    };
    return phases.map(p => map[p] || p).join(', ');
}

function isVaccine(interventions) {
    if (!interventions) return false;
    return interventions.some(i => {
        const name = (i.name || '').toLowerCase();
        const type = (i.type || '').toUpperCase();
        return type === 'BIOLOGICAL' || name.includes('vaccine') || name.includes('immuniz') ||
            name.includes('mrna') || name.includes('vector') || name.includes('toxoid');
    });
}

async function fetchTrials(pathogenName) {
    const url = new URL(CT_API_BASE);
    url.searchParams.set('query.cond', pathogenName);
    url.searchParams.set('pageSize', '50');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Pathogen360/1.0 (research tool)' }
    });

    if (response.status === 429) {
        console.warn(`  Rate limited for ${pathogenName}, waiting 10s...`);
        await sleep(10000);
        return fetchTrials(pathogenName);
    }

    if (!response.ok) {
        throw new Error(`CT API ${response.status} for ${pathogenName}`);
    }

    const data = await response.json();
    return (data.studies || []).map(study => {
        const proto = study.protocolSection || {};
        const id = proto.identificationModule || {};
        const status = proto.statusModule || {};
        const design = proto.designModule || {};
        const interventions = proto.armsInterventionsModule?.interventions || [];
        const sponsors = proto.sponsorCollaboratorsModule || {};
        const conditions = (proto.conditionsModule?.conditions || []).join(', ');
        const locationsModule = proto.contactsLocationsModule?.locations || [];
        const countries = [...new Set(locationsModule.map(loc => loc.country).filter(Boolean))].join(', ');

        return {
            nctId: id.nctId || '',
            title: id.briefTitle || id.officialTitle || '',
            phase: extractPhase(design.phases),
            status: status.overallStatus || null,
            overallStatus: status.overallStatus || null,
            interventionType: (interventions[0]?.type) || null,
            isVaccine: isVaccine(interventions),
            sponsor: sponsors.leadSponsor?.name || null,
            conditions,
            startDate: parseDate(status.startDateStruct?.date),
            primaryCompletionDate: parseDate(status.primaryCompletionDateStruct?.date),
            completionDate: parseDate(status.completionDateStruct?.date),
            locations: countries,
        };
    }).filter(t => t.nctId);
}

async function main() {
    const pathogens = await prisma.pathogen.findMany({ select: { id: true, name: true } });
    console.log(`🔬 Ingesting clinical trials for ${pathogens.length} pathogens...\n`);

    let totalIngested = 0;

    for (const pathogen of pathogens) {
        console.log(`→ [${pathogens.indexOf(pathogen) + 1}/${pathogens.length}] ${pathogen.name}`);
        try {
            const trials = await fetchTrials(pathogen.name);
            console.log(`   Found ${trials.length} trials on ClinicalTrials.gov`);

            let saved = 0;
            for (const trial of trials) {
                try {
                    await prisma.clinicalTrial.upsert({
                        where: { nctId: trial.nctId },
                        update: {
                            title: trial.title,
                            phase: trial.phase,
                            status: trial.status,
                            overallStatus: trial.overallStatus,
                            interventionType: trial.interventionType,
                            isVaccine: trial.isVaccine,
                            sponsor: trial.sponsor,
                            conditions: trial.conditions,
                            locations: trial.locations,
                            startDate: trial.startDate,
                            primaryCompletionDate: trial.primaryCompletionDate,
                            completionDate: trial.completionDate,
                            pathogenId: pathogen.id,
                        },
                        create: {
                            ...trial,
                            pathogenId: pathogen.id,
                        }
                    });
                    saved++;
                } catch (e) {
                    // Trial may already belong to another pathogen — skip
                    if (!e.message.includes('Unique constraint')) {
                        console.warn(`   ⚠ Could not save ${trial.nctId}: ${e.message}`);
                    }
                }
            }
            totalIngested += saved;
            console.log(`   ✅ Saved ${saved} trials\n`);
        } catch (err) {
            console.error(`   ❌ Error for ${pathogen.name}: ${err.message}\n`);
        }

        // Be polite to the API
        await sleep(1500);
    }

    console.log(`\n✅ Clinical trials ingestion complete! Total trials saved: ${totalIngested}`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
