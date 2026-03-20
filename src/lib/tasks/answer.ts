import { prisma } from '@/lib/prisma';
import { generateLLMResponse } from '@/lib/llm';
import { runInContext } from '@/lib/operations';

export async function executeAnswerQuestionTask(opId: string, params: { questionId: string; medicalTermId: string; forceRecompute?: boolean }) {
    const { questionId, medicalTermId, forceRecompute } = params;

    await runInContext(opId, async (ctx) => {
        await ctx.progress(5, 'Fetching question details...');

        const question = await prisma.logicalQuestion.findUnique({
            where: { id: questionId },
            include: { medicalTerm: true }
        });

        if (!question) {
            throw new Error(`Question with ID ${questionId} not found.`);
        }

        // Check cache if not forcing recompute
        if (!forceRecompute && question.answered && question.answer) {
            await ctx.log('Using cached answer.');
            await ctx.progress(100, 'Completed using cache.');
            return;
        }

        await ctx.progress(20, 'Building research context...');
        
        // Use synthesizedContext as the primary source of truth for the answer
        const term = question.medicalTerm;
        if (!term.synthesizedContext) {
            throw new Error(`Medical term "${term.name}" has not been synthesized yet. Please synthesize first.`);
        }

        const systemPrompt = `You are a high-fidelity Medical Research Intelligence Agent. 
        Your task is to answer a specific investigative question based ONLY on the provided Knowledge Nucleus (synthesized medical intelligence).
        
        Guidelines:
        - Be precise, clinical, and data-driven.
        - Use a professional, objective tone.
        - If the provided context doesn't contain enough information to answer fully, state what is known and what remains an open question based on the nucleus.
        - Format your response with clear headers and bullet points if necessary.
        - DO NOT HALLUCINATE. Only use the provided context.`;

        const userPrompt = `
        KNOWLEDGE NUCLEUS FOR: ${term.name}
        ---
        ${term.synthesizedContext}
        ---
        
        INVESTIGATIVE QUESTION: ${question.question}`;

        await ctx.progress(40, 'Generating intelligence response...');
        
        const { content: answer } = await generateLLMResponse([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 0.2); // Low temperature for factual accuracy

        await ctx.progress(90, 'Persisting answer to Knowledge Nucleus (Raw SQL)...');

        // Use raw SQL to bypass potential stale Prisma Client type validation issues
        await prisma.$executeRaw`UPDATE "LogicalQuestion" SET "answer" = ${answer}, "answered" = true, "updatedAt" = ${new Date()} WHERE "id" = ${questionId}`;

        await ctx.log(`✓ Answered: ${question.question.substring(0, 50)}...`);
        await ctx.progress(100, 'Answer generated and persisted.');
    });
}
