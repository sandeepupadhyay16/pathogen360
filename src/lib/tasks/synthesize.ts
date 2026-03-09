import { prisma } from '@/lib/prisma';
import { synthesizePathogenContext } from '@/lib/synthesize';
import { runInContext } from '@/lib/operations';

export async function executeSynthesizeTask(opId: string, params: any) {
    const { pathogenId, all, force } = params;

    await runInContext(opId, async (ctx) => {
        let targets: { id: string; name: string; synthesizedContext: string | null }[] = [];

        if (all) {
            targets = await prisma.pathogen.findMany({
                select: { id: true, name: true, synthesizedContext: true },
                orderBy: { name: 'asc' }
            });
        } else if (pathogenId) {
            const p = await prisma.pathogen.findUnique({
                where: { id: pathogenId },
                select: { id: true, name: true, synthesizedContext: true }
            });
            if (p) targets = [p];
        }

        let skippedCount = 0;
        if (all && !force) {
            const initial = targets.length;
            targets = targets.filter(t => !t.synthesizedContext);
            skippedCount = initial - targets.length;
            if (skippedCount > 0) {
                await ctx.log(`Resuming: skipping ${skippedCount} already-synthesized pathogens.`);
            }
        }

        if (targets.length === 0) {
            await ctx.log("Nothing to synthesize.");
            return;
        }

        await ctx.log(`Starting synthesis for ${targets.length} pathogen(s)...`);
        const taskStart = Date.now();

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            const pathogensCompleted = i;
            const pathogensRemaining = targets.length - i;

            const basePct = (i / targets.length) * 100;
            const weight = 100 / targets.length;

            await ctx.checkAbort();

            try {
                // Get all articles/trials for this pathogen
                const allArticles = await prisma.article.findMany({
                    where: { pathogenId: target.id },
                    orderBy: { publicationDate: 'desc' },
                }) as any[];

                const allTrials = await prisma.clinicalTrial.findMany({
                    where: { pathogenId: target.id },
                    orderBy: { startDate: 'desc' },
                }) as any[];

                if (allArticles.length === 0 && allTrials.length === 0) {
                    await ctx.log(`Skipping ${target.name} (no data)`);
                    continue;
                }

                // Identify Delta: items added since last synthesis
                // If never synthesized, all items are new
                const lastSync = target.synthesisUpdatedAt;
                const newArticles = lastSync
                    ? allArticles.filter(a => a.createdAt > lastSync)
                    : allArticles;
                const newTrials = lastSync
                    ? allTrials.filter(t => t.createdAt > lastSync)
                    : allTrials;

                const isIncremental = !!(lastSync && target.synthesizedContext && (newArticles.length > 0 || newTrials.length > 0));

                if (isIncremental) {
                    await ctx.log(`Found ${newArticles.length} new articles and ${newTrials.length} new trials for ${target.name}. Triggering incremental update.`);
                } else if (lastSync && newArticles.length === 0 && newTrials.length === 0 && !force) {
                    await ctx.log(`No new data for ${target.name}. Skipping.`);
                    continue;
                }

                const { nucleus, model, epiMetrics, alerts } = await ctx.step(`Synthesize ${target.name}`, () =>
                    synthesizePathogenContext(
                        target.id,
                        target.name,
                        allArticles,
                        allTrials,
                        async (subPct, subMsg) => {
                            const totalPct = Math.floor(basePct + (subPct / 100) * weight);
                            let etaMsg = "Estimating...";
                            if (totalPct > 0 && totalPct < 100) {
                                const elapsedMs = Date.now() - taskStart;
                                const msPerPct = elapsedMs / totalPct;
                                const remainingPct = 100 - totalPct;
                                const remainingMs = msPerPct * remainingPct;
                                const remainingMin = Math.ceil(remainingMs / 60000);
                                etaMsg = remainingMin < 1 ? "< 1m remaining" : `${remainingMin}m remaining`;
                            } else if (totalPct === 100) {
                                etaMsg = "Almost done...";
                            }
                            await ctx.progress(totalPct, `${target.name}: ${subMsg} (${etaMsg})`);
                            if (subPct === 0 || subPct === 100) await ctx.log(`[${target.name}] ${subMsg}`);
                        },
                        ctx.checkAbort,
                        isIncremental ? target.synthesizedContext : null,
                        newArticles,
                        newTrials
                    )
                );

                await ctx.step(`Save ${target.name} results`, () => prisma.$transaction([
                    prisma.pathogen.update({
                        where: { id: target.id },
                        data: {
                            synthesizedContext: nucleus,
                            synthesisUpdatedAt: new Date(),
                            synthesisArticleCount: allArticles.length
                        },
                    }),
                    prisma.epidemiologyMetric.deleteMany({ where: { pathogenId: target.id } }),
                    prisma.epidemiologyMetric.createMany({
                        data: epiMetrics.map(m => ({ ...m, pathogenId: target.id, source: 'WHO' }))
                    }),
                    prisma.surveillanceAlert.deleteMany({ where: { pathogenId: target.id } }),
                    prisma.surveillanceAlert.createMany({
                        data: alerts.map(a => ({ ...a, pathogenId: target.id }))
                    })
                ]));

                await ctx.log(`✓ ${target.name} complete.`);
            } catch (err: any) {
                await ctx.log(`✗ ${target.name} failed: ${err.message}`, 'ERROR');
            }
        }
    });
}
