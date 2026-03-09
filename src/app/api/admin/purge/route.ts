import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOperation, runInContext } from '@/lib/operations';

export async function POST() {
    try {
        const operation = await createOperation('PURGE', 'Entire Database');

        // Execute in background
        const purgeTask = async () => {
            await runInContext(operation.id, async (ctx) => {
                await ctx.log("Initiating full system purge...");

                await ctx.step("Delete KnowledgeChunks", () => prisma.knowledgeChunk.deleteMany({}));
                await ctx.step("Delete EpidemiologyMetrics", () => prisma.epidemiologyMetric.deleteMany({}));
                await ctx.step("Delete SurveillanceAlerts", () => prisma.surveillanceAlert.deleteMany({}));
                await ctx.step("Delete ClinicalTrials", () => (prisma as any).clinicalTrial.deleteMany({}));
                await ctx.step("Delete MarketReports", () => prisma.marketReport.deleteMany({}));
                await ctx.step("Delete Articles", () => prisma.article.deleteMany({}));
                await ctx.step("Delete Pathogens", () => prisma.pathogen.deleteMany({}));

                await ctx.log("Clearing diagnostic and interactive data...");
                await ctx.step("Delete Messages", () => prisma.message.deleteMany({}));
                await ctx.step("Delete Conversations", () => prisma.conversation.deleteMany({}));
                await ctx.step("Delete SearchHistory", () => prisma.searchHistory.deleteMany({}));
                await ctx.step("Delete SemanticCache", () => prisma.semanticCache.deleteMany({}));

                await ctx.log("System purge complete.");
            });
        };

        purgeTask().catch(err => console.error("Purge background fail:", err));

        return NextResponse.json({
            message: 'Purge initiated in background',
            operationId: operation.id
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
