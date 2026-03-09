import { generateLLMResponse, embedText, stripLLMChatter } from './llm';
import { fetchWhoMetrics, WhoMetric } from './who';
import { fetchCdcAlerts, SurveillanceAlert } from './cdc';
import { prisma } from './prisma';

const BATCH_SIZE = 15;
const MAX_BATCHES_BEFORE_RECURSION = 10;
const ARTICLE_CHUNK_SIZE = 8000; // Increased slightly
const LONG_ARTICLE_THRESHOLD = 4000; // Increased slightly
const CONCURRENCY_LIMIT = 5; // Process 5 LLM/Embedding requests at a time

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
    pathogenName: string,
    article: { pubmedId: string; title: string; abstractText: string | null; publicationDate?: Date | null },
    fidelity: 'high' | 'balanced' | 'aggressive'
): Promise<string> {
    const text = article.abstractText || '';
    const year = article.publicationDate ? new Date(article.publicationDate).getFullYear() : 'Unknown year';
    const pmidUrl = `https://pubmed.ncbi.nlm.nih.gov/${article.pubmedId}/`;
    const header = `[PMID: ${article.pubmedId}](${pmidUrl}) "${article.title}" (${year})`;

    if (fidelity === 'aggressive') {
        return `${header}`; // Title and link only for old research
    }

    if (fidelity === 'balanced' || text.length <= LONG_ARTICLE_THRESHOLD) {
        const summaryPrompt = fidelity === 'balanced'
            ? `Summarize this article's key vaccine findings in 2-3 bullets maximum.\n\nTEXT:\n${text}`
            : `Extract key findings relevant to vaccines/therapeutics from this article.\n\nTEXT:\n${text}`;

        const { content: rawSummary } = await generateLLMResponse([
            { role: 'system', content: 'You are a biomedical analyst. Provide ONLY clinical bullets. NO preambles or conversational text.' },
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

    // Process chunks in parallel with a tighter limit for a single article
    const chunkSummaries = await parallelMap(chunks, 3, async (chunk, i) => {
        const chunkPrompt = `Extract 3-5 factual findings from chunk ${i + 1}/${chunks.length} of the article: ${header}. Focus on efficacy and safety.\n\nTEXT:\n${chunk}`;
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

async function createChunk(pathogenId: string, sourceType: string, sourceId: string, content: string) {
    try {
        const embedding = await embedText(content.substring(0, 8000));
        const embeddingStr = `[${embedding.join(',')}]`;
        await prisma.$executeRaw`
            INSERT INTO "KnowledgeChunk" ("id", "pathogenId", "sourceType", "sourceId", "content", "embedding", "createdAt")
            VALUES (gen_random_uuid(), ${pathogenId}, ${sourceType}, ${sourceId}, ${content}, ${embeddingStr}::vector, NOW())
            ON CONFLICT DO NOTHING
        `;
    } catch (err) {
        console.error(`Failed to create KnowledgeChunk for ${sourceType} ${sourceId}:`, err);
    }
}

/**
 * Recursive synthesis to compress large amounts of intermediate text.
 */
async function compressBatchSummaries(pathogenName: string, summaries: string[]): Promise<string[]> {
    if (summaries.length <= MAX_BATCHES_BEFORE_RECURSION) return summaries;

    console.log(`[RECURSIVE SYNTHESIS] Compressing ${summaries.length} intermediate summaries for ${pathogenName}...`);
    const superBatches: string[][] = [];
    for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
        superBatches.push(summaries.slice(i, i + BATCH_SIZE));
    }

    // Parallelize batch compression
    const results = await parallelMap(superBatches, CONCURRENCY_LIMIT, async (batch) => {
        const superPrompt = `Consolidate these research summaries into a one-page "Thematic Trend Overview" for ${pathogenName}. Group findings by vaccine pipeline, safety signals, and clinical efficacy.\n\nSUMMARIES:\n${batch.join('\n\n')}`;
        const { content: batchSummaryResult } = await generateLLMResponse([
            { role: 'system', content: 'You are a head of research. Provide a thematic summary without preambles.' },
            { role: 'user', content: superPrompt }
        ], 0.2);
        return stripLLMChatter(batchSummaryResult);
    });

    // Recurse if still too many
    return compressBatchSummaries(pathogenName, results);
}

export async function synthesizePathogenContext(
    pathogenId: string,
    pathogenName: string,
    articles: Array<{ id: string; pubmedId: string; title: string; abstractText: string | null; publicationDate?: Date | null }>,
    clinicalTrials: Array<{
        id: string; nctId: string; title: string; phase?: string | null; overallStatus?: string | null;
        sponsor?: string | null; enrollment?: number | null; description?: string | null;
        primaryOutcomes?: string | null; interventionDetails?: string | null;
        studyDesign?: string | null; startDate?: Date | null; isVaccine?: boolean;
    }>,
    onProgress?: (pct: number, msg: string) => void,
    checkAbort?: () => Promise<void>,
    existingNucleus?: string | null,
    deltaArticles?: any[],
    deltaTrials?: any[]
): Promise<{
    nucleus: string,
    model: string,
    epiMetrics: WhoMetric[],
    alerts: SurveillanceAlert[]
}> {
    const report = (pct: number, msg: string) => onProgress?.(pct, msg);
    const abort = async () => await checkAbort?.();

    const isIncremental = !!existingNucleus && (deltaArticles || []).length > 0;
    const itemsToSummarize = isIncremental ? (deltaArticles || []) : articles;
    const trialsToSummarize = isIncremental ? (deltaTrials || []) : clinicalTrials;

    report(2, `${isIncremental ? 'Incremental' : 'Full'} synthesis for ${pathogenName}. Processing ${itemsToSummarize.length} new articles.`);

    if (!isIncremental) {
        await (prisma as any).knowledgeChunk.deleteMany({ where: { pathogenId } });
    }

    report(3, `Fetching WHO/CDC updates...`);
    const [whoMetrics, cdcAlerts] = await Promise.all([
        fetchWhoMetrics(pathogenName),
        fetchCdcAlerts(pathogenName)
    ]);

    // 1. Parallel Article Processing (Only for new/requested items)
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

        const summary = await summarizeArticle(pathogenName, article, fidelity);
        createChunk(pathogenId, 'ARTICLE', article.id, `[PMID:${article.pubmedId}] ${article.title}\n${article.abstractText || ''}`);

        return summary;
    });

    // 2. Parallel Trial Processing
    report(40, `Processing ${trialsToSummarize.length} clinical trials...`);
    const trialSummaries = await parallelMap(trialsToSummarize, CONCURRENCY_LIMIT, async (t) => {
        const trialUrl = `https://clinicaltrials.gov/study/${t.nctId}`;
        const trialText = `[NCT: ${t.nctId}](${trialUrl}) ${t.title} (${t.phase}, ${t.overallStatus})`;
        await createChunk(pathogenId, 'TRIAL', t.id, `${trialText}\nInterventions: ${t.interventionDetails}`);
        return trialText;
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
            ? `Extract the most significant NEW research findings for "${pathogenName}" from these recent articles. Focus on updates to efficacy or safety.\n\nNEW ARTICLES:\n${batch.join('\n\n')}`
            : `Synthesize these research papers for "${pathogenName}". Extract the most significant trends in clinical efficacy and safety candidate selection.\n\nARTICLES:\n${batch.join('\n\n')}`;
        const { content: rawBatchResult } = await generateLLMResponse([
            { role: 'system', content: 'You are a technical analyst. Synthesize findings. Data only.' },
            { role: 'user', content: batchPrompt }
        ], 0.2);
        return stripLLMChatter(rawBatchResult);
    });

    batchSummaries = await compressBatchSummaries(pathogenName, batchSummaries);

    // 4. Final Consolidation / Merging
    report(85, `${isIncremental ? 'Merging updates into' : 'Building final'} Knowledge Nucleus...`);

    const trialContext = trialSummaries.slice(0, 20).join('\n');
    const epiContext = whoMetrics.slice(0, 10).map(m => `${m.location} ${m.year}: ${m.indicator} = ${m.value}`).join('\n');
    const alertContext = cdcAlerts.slice(0, 5).map(a => `${a.title} (${a.publishedAt.toLocaleDateString()})`).join('\n');

    let consolidationPrompt = "";

    if (isIncremental && existingNucleus) {
        consolidationPrompt = `You are a senior pharmaceutical strategist. 
I have an existing "Knowledge Nucleus" for ${pathogenName} and I have discovered NEW details from recent ingestion.

STRICT INSTRUCTIONS:
1. UPDATE the existing report below by integrating the NEW FINDINGS.
2. If new clinical trial results or research findings contradict or advance the existing text, update the section accordingly.
3. Preserve the general structure (Pipeline, Epidemiology, Safety, Gaps).
4. Do NOT simply append; perform a NARRATIVE MERGE.
5. Keep all absolute Markdown links intact.
6. NO INTRODUCTORY TEXT. Start directly with the updated content.
7. Maintain Markdown tables for comparisons.

EXISTING KNOWLEDGE NUCLEUS:
${existingNucleus}

NEW RESEARCH FINDINGS:
${batchSummaries.join('\n\n')}

NEW CLINICAL TRIALS:
${trialContext}

LATEST EPIDEMIOLOGY (WHO/CDC):
${epiContext}
${alertContext}`;
    } else {
        consolidationPrompt = `You are the lead intelligence analyst for a vaccine division.
Create a "Knowledge Nucleus" for ${pathogenName}.

OUTPUT FORMATTING RULES:
- NO PREAMBLE. Do not say "Okay," or "Here is the report."
- Start EXACTLY with the header: # ${pathogenName} - Knowledge Nucleus
- SECOND LINE: *Focused on 2024-2026 literature and ongoing clinical trials*
- SECTION 1: ## 1. Current Pipeline Status. This section MUST be a Markdown table with columns: [Candidate, Development Stage, Key Mechanism, Primary Indication, Notable Safety/Efficacy Data].
- SECTION 2: ## 2. Disease Burden & Epidemiology. 
- SECTION 3: ## 3. Safety & Efficacy Signals.
- SECTION 4: ## 4. Strategic Intelligence & Gaps.
- Use absolute Markdown links for citations: [PMID: 123](URL) or [NCT: 123](URL).

LITERATURE TRENDS:
${batchSummaries.join('\n\n')}

RECENT CLINICAL TRIALS:
${trialContext}

EPIDEMIOLOGY & SURVEILLANCE:
WHO: ${epiContext}
CDC: ${alertContext}`;
    }

    const { content: rawNucleus, model } = await generateLLMResponse([
        { role: 'system', content: 'You are an AI specialized in pharmaceutical market intelligence. You provide high-fidelity, data-dense reports without conversational filler.' },
        { role: 'user', content: consolidationPrompt }
    ], 0.2);

    const nucleus = stripLLMChatter(rawNucleus);

    report(100, `Knowledge Nucleus successfully ${isIncremental ? 'updated' : 'generated'}.`);

    return {
        nucleus,
        model,
        epiMetrics: whoMetrics,
        alerts: cdcAlerts
    };
}



