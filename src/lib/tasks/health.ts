import { prisma } from '@/lib/prisma';
import { runInContext } from '@/lib/operations';
import { fetchWhoMetrics } from '@/lib/who';
import { fetchCdcAlerts } from '@/lib/cdc';

export async function syncHealthForPathogen(pathogen: { id: string, name: string }, ctx: any) {
    try {
        const [whoMetrics, cdcAlerts] = await ctx.step(`Fetch metrics for ${pathogen.name}`, () =>
            Promise.all([
                fetchWhoMetrics(pathogen.name),
                fetchCdcAlerts(pathogen.name)
            ])
        );

        await ctx.step(`Save metrics for ${pathogen.name}`, () => prisma.$transaction([
            prisma.epidemiologyMetric.deleteMany({ where: { pathogenId: pathogen.id } }),
            prisma.epidemiologyMetric.createMany({
                data: whoMetrics.map(m => ({ ...m, pathogenId: pathogen.id, source: 'WHO' }))
            }),
            prisma.surveillanceAlert.deleteMany({ where: { pathogenId: pathogen.id } }),
            prisma.surveillanceAlert.createMany({
                data: cdcAlerts.map(a => ({ ...a, pathogenId: pathogen.id }))
            })
        ]));

        await ctx.log(`✓ ${pathogen.name} health data sync complete.`);
    } catch (err: any) {
        await ctx.log(`✗ ${pathogen.name} health sync failed: ${err.message}`, 'WARN');
        throw err;
    }
}

export async function executeHealthTask(opId: string) {
    await runInContext(opId, async (ctx) => {
        const pathogens = await prisma.pathogen.findMany({ select: { id: true, name: true } });
        if (pathogens.length === 0) {
            await ctx.log("No pathogens to sync.");
            return;
        }

        await ctx.log(`Starting Global Health Sync for ${pathogens.length} pathogens...`);

        for (let i = 0; i < pathogens.length; i++) {
            const pathogen = pathogens[i];
            await ctx.progress(Math.floor((i / pathogens.length) * 100), `Syncing WHO/CDC data for ${pathogen.name}`);
            await syncHealthForPathogen(pathogen, ctx);
        }
    });
}
