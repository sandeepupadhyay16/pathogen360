import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/clinical-trials/[pathogenId]
 * Returns all clinical trials for a given pathogen.
 */
export async function GET(
    _request: Request,
    { params }: { params: { pathogenId: string } }
) {
    try {
        const { pathogenId } = params;

        const trials = await (prisma as any).clinicalTrial.findMany({
            where: { pathogenId },
            orderBy: { startDate: 'desc' },
        });

        // Compute summary stats
        const totalTrials = trials.length;
        const vaccineTrials = trials.filter((t: any) => t.isVaccine).length;
        const activeTrials = trials.filter((t: any) =>
            ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION', 'NOT_YET_RECRUITING'].includes(
                (t.overallStatus || '').toUpperCase().replace(/ /g, '_')
            )
        ).length;

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
