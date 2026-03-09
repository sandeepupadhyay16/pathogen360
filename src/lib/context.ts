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

export function buildPathogenContext(matchedPathogen: any): { context: string, sources: ContextSource[], visuals: any } {
    const sources: ContextSource[] = [];
    let refCounter = 1;

    // --- PRIMARY CONTEXT: Synthesized Knowledge Nucleus ---
    let primaryContext = '';
    if (matchedPathogen.synthesizedContext) {
        const articleCount = matchedPathogen.synthesisArticleCount || 'unknown';
        primaryContext = `[Knowledge Nucleus — synthesized from ${articleCount} PubMed articles]\n${matchedPathogen.synthesizedContext}\n---\n`;
    }

    // --- SUPPLEMENTAL: Recent Articles (for granular citations) ---
    const articleSummaries = matchedPathogen.articles.slice(0, PARAMETERS.DATA_FETCHING.MAX_ARTICLES).map((a: any) => {
        const idx = refCounter++;
        sources.push({
            id: a.pubmedId,
            type: 'article',
            title: a.title,
            authors: a.authors,
            date: a.publicationDate,
            refIndex: idx,
        });
        return `[${idx}] [Article: ${a.pubmedId}]\nTitle: ${a.title}\nAuthors: ${a.authors}\nAbstract: ${a.abstractText}`;
    }).join('\n\n');

    // Add report to sources if it exists
    if (matchedPathogen.reports && matchedPathogen.reports.length > 0) {
        const report = matchedPathogen.reports[0];
        const idx = refCounter++;
        sources.push({
            id: report.id,
            type: 'report',
            title: `Market Potential Report: ${matchedPathogen.name}`,
            date: report.createdAt,
            refIndex: idx,
        });
    }

    // --- CLINICAL TRIALS CONTEXT ---
    const trialData = formatClinicalTrialsContext(matchedPathogen.name, matchedPathogen.clinicalTrials);

    // --- HARD METRICS & SURVEILLANCE (WHO/CDC) ---
    let epiContext = '';
    let epiVisuals = null;
    if (matchedPathogen.epidemiologyMetrics && matchedPathogen.epidemiologyMetrics.length > 0) {
        const metrics = matchedPathogen.epidemiologyMetrics.slice(0, PARAMETERS.DATA_FETCHING.MAX_EPI_METRICS);
        epiContext += `\n[Epidemiological Metrics — sourced from WHO GHO]\n${metrics.map((m: any) => `- ${m.location} (${m.year}): ${m.indicator} = ${m.value} ${m.unit || ''}`).join('\n')}\n`;
        
        // Prepare epi visuals
        epiVisuals = {
            epidemiologyMetrics: metrics.map((m: any) => ({
                name: `${m.location} (${m.year})`,
                value: m.value,
                indicator: m.indicator
            })),
            title: `Epidemiology: ${matchedPathogen.name}`
        };
    } else {
        epiContext += `\n[Epidemiological Metrics — WHO GHO]\nNo structured epidemiological metrics (incidence, mortality, or coverage) are available in the Pathogen 360 database for this pathogen.\n`;
    }

    if (matchedPathogen.surveillanceAlerts && matchedPathogen.surveillanceAlerts.length > 0) {
        const alerts = matchedPathogen.surveillanceAlerts.slice(0, PARAMETERS.DATA_FETCHING.MAX_SURVEILLANCE_ALERTS);
        epiContext += `\n[Surveillance Alerts — sourced from CDC MMWR]\n${alerts.map((a: any) => `- ${a.title} (${new Date(a.publishedAt).toLocaleDateString()}): ${a.url}`).join('\n')}\n`;
    } else {
        epiContext += `\n[Surveillance Alerts — CDC MMWR]\nNo recent surveillance alerts or outbreak reports were found in the database for this pathogen.\n`;
    }

    // Add trial sources with reference indices
    for (const ts of trialData.sources) {
        const idx = refCounter++;
        ts.refIndex = idx;
        sources.push({ ...ts, refIndex: idx });
    }

    const fullContext = `${primaryContext}${articleSummaries}\n\n${trialData.context}${epiContext}`;

    // Build numbered reference list for the LLM
    const refList = sources.map(s => {
        const dateStr = s.date ? new Date(s.date as string).toLocaleDateString() : '';
        const authorStr = s.authors ? ` (${s.authors})` : '';
        if (s.type === 'article') {
            return `[${s.refIndex}] Article: "${s.title}", PMID: ${s.id} ${dateStr}`;
        } else if (s.type === 'clinical_trial') {
            return `[${s.refIndex}] Clinical Trial: "${s.title}", NCT ID: ${s.id} ${dateStr}`;
        } else if (s.type === 'report' || s.type === 'strategic_report') {
            return `[${s.refIndex}] Strategic Report: "${s.title}", ID: ${s.id} ${dateStr}`;
        } else {
            return `[${s.refIndex}] ${s.type.replace(/_/g, ' ').toUpperCase()}: "${s.title}", ID: ${s.id} ${dateStr}`;
        }
    }).join('\n');

    // DYNAMIC VISUAL PRIORITIZATION
    // If epi data is available, we'll provide it as a priority visual option
    const visuals = {
        ...trialData.visuals,
        epiVisuals,
        primaryVisual: epiVisuals ? 'epidemiology' : 'clinical_trials'
    };

    return {
        context: fullContext + '\n\n--- NUMBERED REFERENCES ---\n' + refList,
        sources,
        visuals
    };
}

export function buildAggregateContext(pathogens: any[], title: string): { context: string, sources: ContextSource[], visuals: any } {
    const sources: ContextSource[] = [];
    let refCounter = 1;
    let context = `--- GROUND TRUTH AGGREGATE TABLES ---\n\n`;
    context += `**AUTHORITATIVE DATASET:** ${title}\n`;
    context += `The tables below are extracted directly from the Pathogen 360 database. Use these tables to rank, compare, and summarize pathogens. Every row is cited with [N].\n\n`;

    // 1. Pathogen Comparison Table (General Overview)
    const comparison = generateAggregateComparisonTable(pathogens, sources, refCounter);
    context += comparison.context;
    refCounter = comparison.nextRef;

    // 2. Clinical Trial Activity (Analytics Focused)
    const trials = generateAggregateTrials(pathogens, sources, refCounter);
    context += trials.context;
    refCounter = trials.nextRef;

    // 3. Epidemiology Summary (WHO Metrics)
    const epi = generateAggregateEpidemiology(pathogens, sources, refCounter);
    context += epi.context;
    refCounter = epi.nextRef;

    // 4. Surveillance Alerts (Outbreak Timeline)
    const surveillance = generateAggregateSurveillance(pathogens, sources, refCounter);
    context += surveillance.context;
    refCounter = surveillance.nextRef;

    // Build numbered reference list for the LLM
    const refList = sources.map(s => {
        const dateStr = s.date ? (typeof s.date === 'string' ? s.date : new Date(s.date).toLocaleDateString()) : '';
        const readableType = s.type.replace(/_/g, ' ').toUpperCase();
        return `[${s.refIndex}] ${readableType}: "${s.title}", ID: ${s.id} ${dateStr}`;
    }).join('\n');

    const visuals = {
        aggregateTrialActivity: trials.visualData,
        aggregateEpiActivity: epi.visualData,
        summaryText: `This aggregate analysis covers ${pathogens.length} pathogens. Clinical trial activity is highest for ${trials.visualData[0]?.name || 'N/A'}, while recent surveillance indicates ${surveillance.count} active alerts across the tracked portfolio.`,
        primaryVisual: 'clinical_trials' // Default for aggregate
    };

    return { 
        context: context + '\n\n--- NUMBERED REFERENCES ---\n' + refList, 
        sources,
        visuals
    };
}

/**
 * Internal helper to generate the core comparison table.
 */
function generateAggregateComparisonTable(pathogens: any[], sources: ContextSource[], startRef: number) {
    let context = `## Pathogen Strategic Overview\n\n`;
    context += `| Rank | Pathogen [N] | Family | Market Potential | Investment Gaps | Status |\n`;
    context += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    
    let refCounter = startRef;
    const sorted = [...pathogens].sort((a, b) => (b.reports?.[0]?.marketPotentialScore || 0) - (a.reports?.[0]?.marketPotentialScore || 0) || a.name.localeCompare(b.name)).slice(0, 15);
    
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
                title: `Market Potential Report: ${p.name}`,
                date: r.createdAt,
                refIndex: refIdx
            });
            refIndicator = ` [REF ${refIdx}]`;
        }

        context += `| ${rank++} | ${p.name}${refIndicator} | ${p.family || 'N/A'} | ${report.marketPotential || 'N/A'} | ${report.investmentGaps || 'N/A'} | ${status} |\n`;
    }
    return { context, nextRef: refCounter };
}

/**
 * Internal helper to generate the epidemiology summary.
 */
function generateAggregateEpidemiology(pathogens: any[], sources: ContextSource[], startRef: number) {
    let context = `\n## Epidemiology Summary (WHO GHO Data)\n\n`;
    context += `| Rank | Pathogen [N] | Primary Indicator | Value | Location/Year |\n`;
    context += `| :--- | :--- | :--- | :--- | :--- |\n`;

    // Group metrics by pathogen, picking the highest value metric for each
    const pathogenMetrics: any[] = [];
    pathogens.forEach(p => {
        if (p.epidemiologyMetrics?.[0]) {
            const topMetric = [...p.epidemiologyMetrics].sort((a, b) => b.value - a.value)[0];
            pathogenMetrics.push({ ...topMetric, pathogenName: p.name, pathogenId: p.id });
        }
    });
    const sortedPathogens = pathogenMetrics.sort((a, b) => b.value - a.value).slice(0, 15);

    let refCounter = startRef;
    let rank = 1;
    for (const m of sortedPathogens) {
        const refIdx = refCounter++;
        sources.push({
            id: m.id || `${m.pathogenId}-metric`,
            type: 'gho_metric',
            title: `WHO GHO: ${m.indicator} (${m.location})`,
            date: `${m.year}`,
            refIndex: refIdx
        });
        context += `| ${rank++} | ${m.pathogenName} [${refIdx}] | ${m.indicator} | ${m.value} ${m.unit || ''} | ${m.location} (${m.year}) |\n`;
    }

    if (sortedPathogens.length === 0) {
        context = `\n## Epidemiology Summary\n\nNo significant epidemiology metrics available for this set.\n`;
    }

    return { 
        context, 
        nextRef: refCounter,
        visualData: sortedPathogens.map(m => ({ name: m.pathogenName, value: m.value, indicator: m.indicator }))
    };
}

/**
 * Internal helper to generate clinical trial activity data.
 */
function generateAggregateTrials(pathogens: any[], sources: ContextSource[], startRef: number) {
    let refCounter = startRef;
    const sortedByTrials = [...pathogens].sort((a, b) => {
        const aTrials = a.clinicalTrials?.length || 0;
        const bTrials = b.clinicalTrials?.length || 0;
        if (bTrials !== aTrials) return bTrials - aTrials;
        const aActive = (a.clinicalTrials || []).filter((t: any) => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING'].includes((t.overallStatus || '').toUpperCase())).length;
        const bActive = (b.clinicalTrials || []).filter((t: any) => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING'].includes((t.overallStatus || '').toUpperCase())).length;
        if (bActive !== aActive) return bActive - aActive;
        return a.name.localeCompare(b.name);
    });

    let context = `\n## Clinical Trial Activity (Top 15 Pathogens)\n\n`;
    context += `| Rank | Pathogen [N] | Total Trials | Active | Vaccines | Top Phase |\n`;
    context += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    const topPathogens = sortedByTrials.slice(0, 15);
    let rank = 1;
    for (const p of topPathogens) {
        const trials = p.clinicalTrials || [];
        const active = trials.filter((t: any) => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING'].includes((t.overallStatus || '').toUpperCase())).length;
        const vaccines = trials.filter((t: any) => t.isVaccine).length;
        
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

        context += `| ${rank++} | ${p.name} [REF ${refIdx}] | ${trials.length} | ${active} | ${vaccines} | ${topPhase} |\n`;
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

/**
 * Internal helper to generate surveillance alert timeline.
 */
function generateAggregateSurveillance(pathogens: any[], sources: ContextSource[], startRef: number) {
    let context = `\n## Recent Surveillance Alerts & Outbreak Indicators\n\n`;
    let refCounter = startRef;
    const allAlerts: any[] = [];
    for (const p of pathogens) {
        if (p.surveillanceAlerts) {
            allAlerts.push(...p.surveillanceAlerts.map((a: any) => ({ ...a, pathogenName: p.name, pathogenId: p.id })));
        }
    }
    const sortedAlerts = allAlerts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 40);
    
    if (sortedAlerts.length > 0) {
        context += `| Date | Pathogen [N] | Alert / Outbreak Title | Impact |\n`;
        context += `| :--- | :--- | :--- | :--- |\n`;
        for (const a of sortedAlerts) {
            const refIdx = refCounter++;
            sources.push({
                id: a.id || a.url,
                type: 'surveillance_alert',
                title: a.title,
                date: a.publishedAt,
                refIndex: refIdx
            });
            context += `| ${new Date(a.publishedAt).toLocaleDateString()} | ${a.pathogenName} [${refIdx}] | ${a.title} | ${a.source || 'CDC'} |\n`;
        }
    } else {
        context += `No recent surveillance alerts found across tracked pathogens.\n`;
    }

    return { context, nextRef: refCounter, count: sortedAlerts.length };
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
8. If a question cannot be answered from the provided sources, say: "This information is not available in the Pathogen 360 knowledge base."
`;

export const FORMATTING_RULES = `
FORMATTING RULES:
- Use Markdown for a clean, structural response.
- Use # or ## for section headers.
- Use clean GFM Tables (| Header | Header |) for data comparisons. Ensure each row is on a new line and columns align.
- Use **bolding** for emphasis and bullet points for lists.
- Put citations inline — do NOT use [KN] or append "Source: Knowledge Nucleus" or similar at the end of sections or as a footer.
`;
