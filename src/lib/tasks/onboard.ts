import { runInContext } from '@/lib/operations';
import { ingestTaskLogic } from './ingest';
import { synthesizeTaskLogic } from './synthesize';

export async function executeOnboardTask(opId: string, params: any) {
    const { medicalTerm } = params;

    await runInContext(opId, async (ctx) => {
        await ctx.log(`Starting full onboarding for: ${medicalTerm}`);
        
        // 1. Ingestion
        await ctx.log("Step 1/2: Ingesting literature and trials...");
        const term = await ingestTaskLogic(ctx, params, opId);
        await ctx.updateMetadata({ medicalTermId: term.id });
        
        // 2. Synthesis
        await ctx.log("Step 2/2: Synthesizing Knowledge Nucleus...");
        // Pass the medicalTermId derived from ingestion to synthesis
        await synthesizeTaskLogic(ctx, { medicalTermId: term.id, force: true }, opId);
        
        await ctx.log(`✓ Full onboarding complete for ${medicalTerm}.`);
    });
}
