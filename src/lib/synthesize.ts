import { generateLLMResponse, embedText, stripLLMChatter } from './llm';
import { prisma } from './prisma';

const BATCH_SIZE = 15;
const MAX_BATCHES_BEFORE_RECURSION = 10;
const ARTICLE_CHUNK_SIZE = 8000;
const LONG_ARTICLE_THRESHOLD = 4000;
const CONCURRENCY_LIMIT = 5;

/**
 * Helper for concurrency control
 */
async function parallelMap<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const queue = items.map((item, index) => ({ item, index }));
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (nextIndex < queue.length) {
            const current = queue[nextIndex++];
            results[current.index] = await fn(current.item, current.index);
        }
    });

    await Promise.all(workers);
    return results;
}

/**
 * Summarizes a single article based on its age (temporal fidelity).
 */
async function summarizeArticle(
    medicalTerm: string,
    article: { pubmedId: string; title: string; abstractText: string | null; publicationDate?: Date | null },
    fidelity: 'high' | 'balanced' | 'aggressive'
): Promise<string> {
    const text = article.abstractText || '';
    const year = article.publicationDate ? new Date(article.publicationDate).getFullYear() : 'Unknown year';
    const pmidUrl = `https://pubmed.ncbi.nlm.nih.gov/${article.pubmedId}/`;
    const header = `[PMID: ${article.pubmedId}](${pmidUrl}) "${article.title}" (${year})`;

    if (fidelity === 'aggressive') {
        return `${header}`;
    }

    if (fidelity === 'balanced' || text.length <= LONG_ARTICLE_THRESHOLD) {
        const summaryPrompt = `Extract key scientific and clinical findings from this article regarding "${medicalTerm}".\n\nTEXT:\n${text}`;

        const { content: rawSummary } = await generateLLMResponse([
            { role: 'system', content: 'You are a biomedical analyst. Provide ONLY factual clinical bullets. NO preambles or conversational text.' },
            { role: 'user', content: summaryPrompt }
        ], 0.2);
        const summary = stripLLMChatter(rawSummary);
        return `${header}\n${summary}`;
    }

    // High fidelity for recent LONG articles - chunked summarization
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += ARTICLE_CHUNK_SIZE) {
        chunks.push(text.slice(i, i + ARTICLE_CHUNK_SIZE));
    }

    const chunkSummaries = await parallelMap(chunks, 3, async (chunk, i) => {
        const chunkPrompt = `Extract key factual findings from chunk ${i + 1}/${chunks.length} of the article regarding "${medicalTerm}": ${header}.\n\nTEXT:\n${chunk}`;
        const { content } = await generateLLMResponse([
            { role: 'system', content: 'You are a clinical researcher. Provide data only.' },
            { role: 'user', content: chunkPrompt }
        ], 0.2);
        return stripLLMChatter(content);
    });

    const mergePrompt = `Synthesize these extracted findings from the article "${article.title}" into a concise single-paragraph summary (max 200 words).\n\nFINDINGS:\n${chunkSummaries.join('\n')}`;
    const { content: rawFinalSummary } = await generateLLMResponse([
        { role: 'system', content: 'You are a senior clinical analyst. Provide a one-paragraph summary. Data only, no chatter.' },
        { role: 'user', content: mergePrompt }
    ], 0.2);

    const finalSummary = stripLLMChatter(rawFinalSummary);
    return `${header}\n${finalSummary}`;
}

async function createChunk(medicalTermId: string, sourceType: string, sourceId: string, content: string) {
    try {
        const embedding = await embedText(content.substring(0, 8000));
        const embeddingStr = `[${embedding.join(',')}]`;
        await prisma.$executeRaw`
            INSERT INTO "KnowledgeChunk" ("id", "medicalTermId", "sourceType", "sourceId", "content", "embedding", "createdAt")
            VALUES (gen_random_uuid(), ${medicalTermId}, ${sourceType}, ${sourceId}, ${content}, ${embeddingStr}::vector, NOW())
            ON CONFLICT DO NOTHING
        `;
    } catch (err) {
        console.error(`Failed to create KnowledgeChunk for ${sourceType} ${sourceId}:`, err);
    }
}

async function compressBatchSummaries(medicalTerm: string, summaries: string[]): Promise<string[]> {
    if (summaries.length <= MAX_BATCHES_BEFORE_RECURSION) return summaries;

    console.log(`[RECURSIVE SYNTHESIS] Compressing ${summaries.length} intermediate summaries for ${medicalTerm}...`);
    const superBatches: string[][] = [];
    for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
        superBatches.push(summaries.slice(i, i + BATCH_SIZE));
    }

    const results = await parallelMap(superBatches, CONCURRENCY_LIMIT, async (batch) => {
        const superPrompt = `Consolidate these research summaries into a thematic overview for ${medicalTerm}.\n\nSUMMARIES:\n${batch.join('\n\n')}`;
        const { content: batchSummaryResult } = await generateLLMResponse([
            { role: 'system', content: 'You are a head of research. Provide a thematic summary without preambles.' },
            { role: 'user', content: superPrompt }
        ], 0.2);
        return stripLLMChatter(batchSummaryResult);
    });

    return compressBatchSummaries(medicalTerm, results);
}

export async function synthesizeMedicalContext(
    medicalTermId: string,
    medicalTerm: string,
    articles: Array<{ id: string; pubmedId: string; title: string; abstractText: string | null; publicationDate?: Date | null }>,
    clinicalTrials: Array<{
        id: string; nctId: string; title: string; phase?: string | null; overallStatus?: string | null;
        sponsor?: string | null; enrollment?: number | null; description?: string | null;
        primaryOutcomes?: string | null; interventionDetails?: string | null;
        studyDesign?: string | null; startDate?: Date | null;
    }>,
    onProgress?: (pct: number, msg: string) => void,
    checkAbort?: () => Promise<void>,
    existingNucleus?: string | null,
    deltaArticles?: any[],
    deltaTrials?: any[],
    timestamp?: Date
): Promise<{
    nucleus: string,
    model: string,
    sources: any[]
}> {
    const report = (pct: number, msg: string) => onProgress?.(pct, msg);
    const abort = async () => await checkAbort?.();

    const isIncremental = !!existingNucleus && (deltaArticles || []).length > 0;
    const itemsToSummarize = isIncremental ? (deltaArticles || []) : articles;
    const trialsToSummarize = isIncremental ? (deltaTrials || []) : clinicalTrials;

    report(2, `${isIncremental ? 'Incremental' : 'Full'} synthesis for ${medicalTerm}. Processing ${itemsToSummarize.length} new articles.`);
    
    const sources: any[] = [];
    let refCounter = 1;

    // Build stable sources list
    itemsToSummarize.forEach((a: any) => {
        sources.push({
            id: a.pubmedId,
            type: 'article',
            title: a.title,
            authors: a.authors,
            date: a.publicationDate,
            refIndex: refCounter++
        });
    });

    trialsToSummarize.forEach((t: any) => {
        sources.push({
            id: t.nctId,
            type: 'clinical_trial',
            title: t.title,
            sponsor: t.sponsor,
            date: t.startDate,
            refIndex: refCounter++
        });
    });

    if (!isIncremental) {
        await (prisma as any).knowledgeChunk.deleteMany({ where: { medicalTermId } });
    }

    // 1. Parallel Article Processing
    report(5, `Processing ${itemsToSummarize.length} articles...`);
    const articleSummaries = await parallelMap(itemsToSummarize, CONCURRENCY_LIMIT, async (article, i) => {
        await abort();
        const progressPct = 5 + Math.floor((i / itemsToSummarize.length) * 35);
        if (i % 5 === 0) report(progressPct, `Processing ${i + 1}/${itemsToSummarize.length}: ${article.title.substring(0, 30)}...`);

        const pubDate = article.publicationDate ? new Date(article.publicationDate as any) : null;
        let fidelity: 'high' | 'balanced' | 'aggressive' = 'aggressive';

        const twentyFourMonthsAgo = new Date();
        twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
        const sixtyMonthsAgo = new Date();
        sixtyMonthsAgo.setMonth(sixtyMonthsAgo.getMonth() - 60);

        if (!pubDate || pubDate >= twentyFourMonthsAgo) fidelity = 'high';
        else if (pubDate >= sixtyMonthsAgo) fidelity = 'balanced';

        const summary = await summarizeArticle(medicalTerm, article, fidelity);
        createChunk(medicalTermId, 'ARTICLE', article.pubmedId, `[PMID:${article.pubmedId}] ${article.title}\n${article.abstractText || ''}`);

        // Find the source and inject the ref index into the summary header
        const s = sources.find(src => src.id === article.pubmedId);
        const refLink = s ? `[${s.refIndex}]` : '';

        return `${refLink} ${summary}`;
    });

    // 2. Parallel Trial Processing
    report(40, `Processing ${trialsToSummarize.length} clinical trials...`);
    const trialSummaries = await parallelMap(trialsToSummarize, CONCURRENCY_LIMIT, async (t) => {
        const trialUrl = `https://clinicaltrials.gov/study/${t.nctId}`;
        const trialText = `Clinical Trial: "${t.title}" (NCT: ${t.nctId}, Phase: ${t.phase}, Status: ${t.overallStatus}, Sponsor: ${t.sponsor}, Enrollment: ${t.enrollment})`;
        await createChunk(medicalTermId, 'TRIAL', t.nctId, `${trialText}\nInterventions: ${t.interventionDetails}`);
        
        // Inject ref index
        const s = sources.find(src => src.id === t.nctId);
        const refLink = s ? `[${s.refIndex}]` : '';
        
        return `${refLink} ${trialText}`;
    });

    // 3. Batch Article Synthesis
    report(60, `Synthesizing ${isIncremental ? 'delta' : 'baseline'} findings...`);
    const batches: string[][] = [];
    for (let i = 0; i < articleSummaries.length; i += BATCH_SIZE) {
        batches.push(articleSummaries.slice(i, i + BATCH_SIZE));
    }

    let batchSummaries = await parallelMap(batches, CONCURRENCY_LIMIT, async (batch, i) => {
        await abort();
        const progressPct = 60 + Math.floor((i / batches.length) * 20);
        report(progressPct, `Summarizing batch ${i + 1}/${batches.length}...`);

        const batchPrompt = isIncremental
            ? `Extract the most significant NEW research findings for "${medicalTerm}" from these recent articles.\n\nNEW ARTICLES:\n${batch.join('\n\n')}`
            : `Synthesize research findings for "${medicalTerm}". Extract major scientific and clinical trends.\n\nARTICLES:\n${batch.join('\n\n')}`;
        const { content: rawBatchResult } = await generateLLMResponse([
            { role: 'system', content: 'You are a technical analyst. Synthesize findings. Data only.' },
            { role: 'user', content: batchPrompt }
        ], 0.2);
        return stripLLMChatter(rawBatchResult);
    });

    batchSummaries = await compressBatchSummaries(medicalTerm, batchSummaries);

    // 4. Final Consolidation / Merging guided by Logical Inquiry
    report(85, `${isIncremental ? 'Merging updates into' : 'Building final'} Knowledge Nucleus...`);

    // Fetch logical questions to guide synthesis
    const logicalQuestionModel = (prisma as any).logicalQuestion;
    if (!logicalQuestionModel) {
        const keys = Object.keys(prisma).filter(k => !k.startsWith('_'));
        console.error(`Prisma model 'logicalQuestion' is undefined in synthesis. Available models: ${keys.join(', ')}`);
        // Fallback to empty if missing to avoid crash, but log error
    }
    
    const logicalQuestions = logicalQuestionModel ? await logicalQuestionModel.findMany({
        where: { medicalTermId }
    }) : [];
    
    const inquiryContext = logicalQuestions.length > 0
        ? `LOGICAL INQUIRY (MANDATORY TO ADDRESS):
${logicalQuestions.map((q: any, i: number) => `${i + 1}. [${q.category}] ${q.question}`).join('\n')}`
        : "";

    const trialContext = trialSummaries.slice(0, 20).join('\n');
    let consolidationPrompt = "";

    if (isIncremental && existingNucleus) {
        consolidationPrompt = `You are a senior biomedical research lead. 
I have an existing "Knowledge Nucleus" for ${medicalTerm} and I have discovered NEW details from recent ingestion.

STRICT INSTRUCTIONS:
1. UPDATE the existing report below by integrating the NEW FINDINGS.
2. Ensure the updated report addresses the following LOGICAL INQUIRY points if new data allows.
3. If new clinical trial results or research findings advance the existing text, update the section accordingly.
4. Preserve the structure (Overview, Research Progress, Clinical Landscape, Strategic Insights).
5. Do NOT simply append; perform a NARRATIVE MERGE.
6. Keep all absolute Markdown links intact.
7. NO INTRODUCTORY TEXT. Start directly with the updated content.
8. Maintain Markdown tables for comparisons.

${inquiryContext}

EXISTING KNOWLEDGE NUCLEUS:
${existingNucleus}

NEW RESEARCH FINDINGS:
${batchSummaries.join('\n\n')}

NEW CLINICAL TRIALS:
${trialContext}`;
    } else {
        consolidationPrompt = `You are a senior biomedical research lead.
Create a "Knowledge Nucleus" for ${medicalTerm}.

STRICT INSTRUCTIONS:
1. Every logical question listed below MUST be addressed in the report.
2. If no data exists for a question in the provided literature, explicitly state that research is currently silent/limited on this specific aspect in the 'Strategic Insights & Research Gaps' section.
3. OUTPUT FORMATTING RULES:
   - NO PREAMBLE.
   - Start EXACTLY with the header: # ${medicalTerm} - Knowledge Nucleus
   - SECOND LINE: *Focused on recent literature and ongoing clinical trials (PubMed & ClinicalTrials.gov)*
   - SECTION 1: ## 1. Scientific Overview. High-level summary addressing pathophysiology and mechanism.
   - SECTION 2: ## 2. Current Clinical Landscape. Markdown table: [Candidate/Intervention, Phase, Status, Mechanism, Key Data].
   - SECTION 3: ## 3. Core Research Findings. Details on efficacy, safety, and patient outcomes.
   - SECTION 4: ## 4. Strategic Insights & Research Gaps. Unmet needs and identified gaps based on the inquiry.

${inquiryContext}

LITERATURE TRENDS:
${batchSummaries.join('\n\n')}

RECENT CLINICAL TRIALS:
${trialContext}`;
    }

    const { content: rawNucleus, model } = await generateLLMResponse([
        { role: 'system', content: 'You are an AI specialized in biomedical intelligence. You provide high-fidelity, data-dense reports without conversational filler.' },
        { role: 'user', content: consolidationPrompt }
    ], 0.2);

    const nucleus = stripLLMChatter(rawNucleus);
    
    if (!nucleus || nucleus.length < 50) {
        console.warn(`[SYNTHESIS] Warning: Predicted Knowledge Nucleus for ${medicalTerm} is suspiciously short (${nucleus?.length || 0} chars). Raw start: "${rawNucleus.substring(0, 100)}..."`);
    } else {
        console.log(`[SYNTHESIS] Generated Knowledge Nucleus for ${medicalTerm} (${nucleus.length} chars).`);
    }

    // 5. Answer Individual Logical Questions
    if (logicalQuestions.length > 0 && logicalQuestionModel) {
        report(95, `Answering individual investigative questions...`);
        const answeringPrompt = `Based on the "Knowledge Nucleus" below, providing a concise 1-2 sentence answer for each of the following investigative questions.
FORMAT: Return a JSON object where keys are the Question IDs and values are the concise answers.
Example: { "uuid-1": "Answer to question 1", "uuid-2": "Answer to question 2" }

QUESTIONS:
${logicalQuestions.map((q: any) => `- [ID: ${q.id}] ${q.question}`).join('\n')}

KNOWLEDGE NUCLEUS:
${nucleus}`;

        const { content: rawAnswers } = await generateLLMResponse([
            { role: 'system', content: 'You are a precise data extractor. Return JSON ONLY. NO CHATTER.' },
            { role: 'user', content: answeringPrompt }
        ], 0.1);

        try {
            // Find JSON in the response (it might be wrapped in backticks)
            const jsonMatch = rawAnswers.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const answerMap = JSON.parse(jsonMatch[0]);
                for (const [qid, answer] of Object.entries(answerMap)) {
                    // Use raw SQL to bypass stale client
                    const qUpdatedAt = timestamp || new Date();
                    await prisma.$executeRaw`
                        UPDATE "LogicalQuestion" 
                        SET "answer" = ${answer as string}, "answered" = true, "updatedAt" = ${qUpdatedAt} 
                        WHERE "id" = ${qid}
                    `;
                }
            }
        } catch (err) {
            console.error('Failed to parse or store logical question answers:', err);
        }
    }

    report(100, `Knowledge Nucleus successfully ${isIncremental ? 'updated' : 'generated'}.`);

    return {
        nucleus,
        model,
        sources
    };
}



