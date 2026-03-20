import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/clinical-trials/[medicalTermId]
 * Returns all clinical trials for a given medical term.
 */
export async function GET(
    request: Request,
    { params }: { params: { medicalTermId: string } }
) {
    const medicalTermId = params.medicalTermId;

    if (!medicalTermId) {
        return NextResponse.json({ error: 'Medical Term ID is required' }, { status: 400 });
    }

    try {
        const trials = await prisma.clinicalTrial.findMany({
            where: { medicalTermId },
            orderBy: { startDate: 'desc' },
        const phaseCounts: Record<string, number> = {};
        for (const trial of trials) {
            const phase = trial.phase || 'Unknown';
            phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
        }

        // Determine if a vaccine is on the horizon (Phase 2 or later, active)
        const lateStageVaccineTrials = trials.filter((t: any) =>
            t.isVaccine &&
            t.phase &&
            (t.phase.includes('Phase 2') || t.phase.includes('Phase 3') || t.phase.includes('Phase 4'))
        );
        const vaccineOnHorizon = lateStageVaccineTrials.length > 0;

        return NextResponse.json({
            trials,
            summary: {
                totalTrials,
                vaccineTrials,
                activeTrials,
                phaseCounts,
                vaccineOnHorizon,
                lateStageVaccineCount: lateStageVaccineTrials.length,
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
