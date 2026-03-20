import { formatClinicalTrialsContext } from './clinicaltrials';
import { PARAMETERS } from '@/config/parameters';

export interface ContextSource {
    id: string;
    type: string;
    title: string;
    authors?: string;
    date?: Date | string | null;
    refIndex?: number; // reference number for inline citation
}

export function buildMedicalTermContext(matchedTerm: any): { context: string, sources: ContextSource[], visuals: any } {
    const sources: ContextSource[] = [];
    let refCounter = 1;

    // --- PRIMARY CONTEXT: Synthesized Knowledge Nucleus ---
    let primaryContext = '';
    if (matchedTerm.synthesizedContext) {
        const articleCount = matchedTerm.synthesisArticleCount || 'unknown';
        primaryContext = `[Knowledge Nucleus — synthesized from ${articleCount} PubMed articles]\n${matchedTerm.synthesizedContext}\n---\n`;
    }

    // --- SUPPLEMENTAL: Recent Articles (for granular citations) ---
    const articleSummaries = matchedTerm.articles.slice(0, PARAMETERS.DATA_FETCHING.MAX_ARTICLES).map((a: any) => {
        const idx = refCounter++;
        sources.push({
            id: a.pubmedId,
            type: 'article',
            title: a.title,
            authors: a.authors,
            date: a.publicationDate,
            refIndex: idx,
        });
        return `[${idx}] [Article: ${a.pubmedId}]\nTitle: ${a.title}\nAuthors: ${a.authors}`;
    }).join('\n\n');

    // Add report to sources if it exists
    if (matchedTerm.reports && matchedTerm.reports.length > 0) {
        const report = matchedTerm.reports[0];
        const idx = refCounter++;
        sources.push({
            id: report.id,
            type: 'report',
            title: `Intelligence Report: ${matchedTerm.name}`,
            date: report.createdAt,
            refIndex: idx,
        });
    }

    // --- CLINICAL TRIALS CONTEXT ---
    const trialData = formatClinicalTrialsContext(matchedTerm.name, matchedTerm.clinicalTrials);

    // Add trial sources with reference indices
    for (const ts of trialData.sources) {
        const idx = refCounter++;
        ts.refIndex = idx;
        sources.push({ ...ts, refIndex: idx });
    }

    const fullContext = `${primaryContext}${articleSummaries}\n\n${trialData.context}`;

    // Build numbered reference list for the LLM
    const refList = sources.map(s => {
        const dateStr = s.date ? new Date(s.date as string).toLocaleDateString() : '';
        const authorStr = s.authors ? ` (${s.authors})` : '';
        if (s.type === 'article') {
            return `[${s.refIndex}] Article: "${s.title}", PMID: ${s.id} ${dateStr}`;
        } else if (s.type === 'clinical_trial') {
            return `[${s.refIndex}] Clinical Trial: "${s.title}", NCT ID: ${s.id} ${dateStr}`;
        } else if (s.type === 'report' || s.type === 'strategic_report') {
            return `[${s.refIndex}] Intelligence Report: "${s.title}", ID: ${s.id} ${dateStr}`;
        } else {
            return `[${s.refIndex}] ${s.type.replace(/_/g, ' ').toUpperCase()}: "${s.title}", ID: ${s.id} ${dateStr}`;
        }
    }).join('\n');

    const visuals = {
        ...trialData.visuals,
        primaryVisual: 'clinical_trials'
    };

    return {
        context: fullContext + '\n\n--- NUMBERED REFERENCES ---\n' + refList,
        sources,
        visuals
    };
}

export function buildAggregateMedicalContext(terms: any[], title: string): { context: string, sources: ContextSource[], visuals: any } {
    const sources: ContextSource[] = [];
    let refCounter = 1;
    let context = `--- GROUND TRUTH AGGREGATE TABLES ---\n\n`;
    context += `**AUTHORITATIVE DATASET:** ${title}\n`;
    context += `The tables below are extracted directly from the Medical 360 database. Use these tables to rank, compare, and summarize medical terms. Every row is cited with [N].\n\n`;

    // 1. Comparison Table
    const comparison = generateAggregateComparisonTable(terms, sources, refCounter);
    context += comparison.context;
    refCounter = comparison.nextRef;

    // 2. Clinical Trial Activity
    const trials = generateAggregateTrials(terms, sources, refCounter);
    context += trials.context;
    refCounter = trials.nextRef;

    // Build numbered reference list for the LLM
    const refList = sources.map(s => {
        const dateStr = s.date ? (typeof s.date === 'string' ? s.date : new Date(s.date).toLocaleDateString()) : '';
        const readableType = s.type.replace(/_/g, ' ').toUpperCase();
        return `[${s.refIndex}] ${readableType}: "${s.title}", ID: ${s.id} ${dateStr}`;
    }).join('\n');

    const visuals = {
        aggregateTrialActivity: trials.visualData,
        summaryText: `This aggregate analysis covers ${terms.length} medical terms. Clinical trial activity is highest for ${trials.visualData[0]?.name || 'N/A'}.`,
        primaryVisual: 'clinical_trials'
    };

    return { 
        context: context + '\n\n--- NUMBERED REFERENCES ---\n' + refList, 
        sources,
        visuals
    };
}

function generateAggregateComparisonTable(terms: any[], sources: ContextSource[], startRef: number) {
    let context = `## Strategic Overview\n\n`;
    context += `| Rank | Term [N] | Category | Market Potential | Investment Gaps | Status |\n`;
    context += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    
    let refCounter = startRef;
    const sorted = [...terms].sort((a, b) => (b.reports?.[0]?.marketPotentialScore || 0) - (a.reports?.[0]?.marketPotentialScore || 0) || a.name.localeCompare(b.name)).slice(0, 15);
    
    let rank = 1;
    for (const p of sorted) {
        const report = p.reports?.[0] || {};
        const status = p.synthesizedContext ? '✅' : '⏳';
        
        let refIndicator = '';
        if (p.reports?.[0]) {
            const r = p.reports[0];
            const refIdx = refCounter++;
            sources.push({
                id: r.id,
                type: 'strategic_report',
                title: `Intelligence Report: ${p.name}`,
                date: r.createdAt,
                refIndex: refIdx
            });
            refIndicator = ` [REF ${refIdx}]`;
        }

        context += `| ${rank++} | ${p.name}${refIndicator} | ${p.category || 'N/A'} | ${report.marketPotential || 'N/A'} | ${report.investmentGaps || 'N/A'} | ${status} |\n`;
    }
    return { context, nextRef: refCounter };
}

function generateAggregateTrials(terms: any[], sources: ContextSource[], startRef: number) {
    let refCounter = startRef;
    const sortedByTrials = [...terms].sort((a, b) => {
        const aTrials = a.clinicalTrials?.length || 0;
        const bTrials = b.clinicalTrials?.length || 0;
        if (bTrials !== aTrials) return bTrials - aTrials;
        const aActive = (a.clinicalTrials || []).filter((t: any) => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING'].includes((t.overallStatus || '').toUpperCase())).length;
        const bActive = (b.clinicalTrials || []).filter((t: any) => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING'].includes((t.overallStatus || '').toUpperCase())).length;
        if (bActive !== aActive) return bActive - aActive;
        return a.name.localeCompare(b.name);
    });

    let context = `\n## Clinical Trial Activity (Top 15 Terms)\n\n`;
    context += `| Rank | Term [N] | Total Trials | Active | Top Phase |\n`;
    context += `| :--- | :--- | :--- | :--- | :--- |\n`;

    const topTerms = sortedByTrials.slice(0, 15);
    let rank = 1;
    for (const p of topTerms) {
        const trials = p.clinicalTrials || [];
        const active = trials.filter((t: any) => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING'].includes((t.overallStatus || '').toUpperCase())).length;
        
        const phaseCount: any = {};
        trials.forEach((t: any) => { if (t.phase) phaseCount[t.phase] = (phaseCount[t.phase] || 0) + 1; });
        const topPhase = Object.entries(phaseCount).sort((a: any, b: any) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A';

        const refIdx = refCounter++;
        sources.push({
            id: `${p.id}-trials`,
            type: 'registry_data',
            title: `Clinical Trial Summary: ${p.name}`,
            date: new Date(),
            refIndex: refIdx
        });

        context += `| ${rank++} | ${p.name} [REF ${refIdx}] | ${trials.length} | ${active} | ${topPhase} |\n`;
    }

    const visualData = sortedByTrials.slice(0, 10).map(p => ({
        name: p.name,
        total: p.clinicalTrials?.length || 0,
        active: (p.clinicalTrials || []).filter((t: any) => 
            ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'].includes((t.overallStatus || '').toUpperCase())
        ).length
    }));

    return { context, nextRef: refCounter, visualData };
}

export const CITATION_RULES = `
CITATION RULES (strictly enforced):
1. Cite ONLY from the numbered sources above. Do NOT use your training data or general knowledge.
2. INLINE CITATION FORMAT: Use superscript-style numbered citations like [1], [2], [3] inline within sentences, placed right after the claim they support. Multiple references can be combined: [1,3,5].
3. NEVER write "Source: Knowledge Nucleus" at the end of sections or as a footer. NO "Source:" text should appear anywhere except as an inline citation number.
4. Every factual claim MUST be attributed to a specific raw source index: [1], [2], etc.
5. When multiple articles support a claim, combine: [1,3,7].
6. DO NOT use [KN] or reference the "Knowledge Nucleus" as a source. Cite the underlying data summaries provided in the tables.
7. BIBLIOGRAPHY: At the very end of your response, include a "## References" section listing all cited references in the format: [N] Article: "Title", PMID: ID or [N] Clinical Trial: "Title", NCT ID: ID. Use the exact "Article:" or "Clinical Trial:" prefix as provided in the Numbered References list above.
8. ONLY if the question is completely unanswerable using the provided sources, your ENTIRE response should be exactly: "This information is not available in the Medical 360 knowledge base." Do NOT append this phrase to an otherwise successful answer.
`;

export const FORMATTING_RULES = `
FORMATTING RULES:
- Use Markdown for a clean, structural response.
- Use # or ## for section headers.
- Use clean GFM Tables (| Header | Header |) for data comparisons. Ensure each row is on a new line and columns align.
- Use **bolding** for emphasis and bullet points for lists.
- Put citations inline — do NOT use [KN] or append "Source: Knowledge Nucleus" or similar at the end of sections or as a footer.
`;
