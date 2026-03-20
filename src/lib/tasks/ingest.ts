import { prisma } from '@/lib/prisma';
import { searchPubMed, fetchPubMedDetails } from '@/lib/pubmed';
import { generateLLMResponse } from '@/lib/llm';
import { runInContext, updateOperation } from '@/lib/operations';
import { syncTrialsForMedicalTerm } from './trials';
import { generateLogicalQuestions } from '../questions';

export async function ingestTaskLogic(ctx: any, params: any, opId: string) {
    const { medicalTerm, maxResults, timeframe = '10y', pubmedDetails = 'abstract', customYearStart, customYearEnd } = params;
    const limit = params.maxResults === 'ALL' ? 1000 : (Number(params.maxResults) || 50);
    const fetchFullText = pubmedDetails === 'full';

    let startYear: number | undefined;
    let endYear: number | undefined;
    const currentYear = new Date().getFullYear();
    if (timeframe === '3y') startYear = currentYear - 3;
    else if (timeframe === '5y') startYear = currentYear - 5;
    else if (timeframe === '10y') startYear = currentYear - 10;
    else if (timeframe === 'custom') {
        startYear = customYearStart;
        endYear = customYearEnd;
    }

    const doSingleIngest = async (termName: string, pStart: number, pEnd: number) => {
        const range = pEnd - pStart;
        const update = async (pct: number, msg: string) => {
            await ctx.progress(pStart + Math.floor((pct / 100) * range), msg);
        };

        await update(5, `Initializing ingestion for ${termName}...`);
        
        // Log exact search parameters to operation metadata
        await updateOperation(opId, {
            metadata: {
                ...params,
                exactSearchParameters: {
                    pubmed: {
                        query: termName,
                        limit: limit,
                        startYear: startYear || null,
                        endYear: endYear || null,
                        fetchFullText: fetchFullText
                    },
                    clinicalTrials: {
                        query: termName,
                        limit: limit
                    }
                }
            } as any
        });

        // Category identification
        const category = await ctx.step(`Identify category for ${termName}`, async () => {
            const categoryPrompt = `Categorize the medical term: "${termName}". 
            Options: Drug, Disease, Molecule, Virus, Bacteria, Medical Procedure, Other.
            Respond with ONLY the category name.`;
            const { content: resp } = await generateLLMResponse([
                { role: 'system', content: 'You are a medical taxonomist.' },
                { role: 'user', content: categoryPrompt }
            ], 0);
            return resp.trim().replace(/\.$/, '').replace(/["']/g, '');
        });

        const term = await prisma.medicalTerm.upsert({
            where: { name: termName },
            update: { category },
            create: { name: termName, category }
        });

        // 1. Generate Logical Questions
        await update(7, `Generating logical investigative questions for ${termName}...`);
        const questions = await ctx.step(`Generate Logical Questions for ${termName}`, () => generateLogicalQuestions(termName));
        
        await ctx.step(`Save ${questions.length} logical questions`, async () => {
            const logicalQuestionModel = (prisma as any).logicalQuestion;
            if (!logicalQuestionModel) {
                const keys = Object.keys(prisma).filter(k => !k.startsWith('_'));
                throw new Error(`Prisma model 'logicalQuestion' is undefined. Available models: ${keys.join(', ')}`);
            }
            
            // Clear old questions for this term if any
            await logicalQuestionModel.deleteMany({ where: { medicalTermId: term.id } });
            for (const q of questions) {
                await (prisma as any).logicalQuestion.create({
                    data: {
                        medicalTermId: term.id,
                        question: q.question,
                        category: q.category,
                        searchKeywords: q.searchKeywords
                    }
                });
            }
        });

        // 2. PubMed Multi-Cluster Search
        await update(10, `Searching PubMed for ${termName} (Multi-cluster)...`);
        
        // Build a set of unique search queries: original term + question-based keywords
        const searchQueries = [
            termName,
            ...questions.map(q => q.searchKeywords).filter(Boolean)
        ].slice(0, 8); // Limit to top 8 clusters to avoid infinite search
        
        // Update metadata with the expanded clusters for transparency in Operations UI
        await updateOperation(opId, {
            metadata: {
                ...params,
                exactSearchParameters: {
                    pubmed: {
                        query: termName,
                        limit: limit,
                        startYear: startYear || null,
                        endYear: endYear || null,
                        fetchFullText: fetchFullText,
                        clusters: searchQueries
                    },
                    clinicalTrials: {
                        query: termName,
                        limit: limit,
                        clusters: searchQueries.slice(0, 4) // Fewer clusters for trials
                    }
                }
            } as any
        });
        
        const allPubmedIds = new Set<string>();
        const clusterStats: any[] = [];
        let totalRawFound = 0;
        
        for (let i = 0; i < searchQueries.length; i++) {
            const query = searchQueries[i];
            await update(10 + Math.floor((i / searchQueries.length) * 20), `Search cluster ${i+1}/${searchQueries.length}: ${query.substring(0, 20)}...`);
            
            if (i > 0) {
                const { sleep } = await import('@/lib/utils');
                await sleep(1000);
            }

            const subLimit = i === 0 ? limit : Math.max(10, Math.floor(limit / 2));
            const ids = await searchPubMed(query, subLimit, startYear, endYear);
            
            totalRawFound += ids.length;
            clusterStats.push({
                query,
                limit: subLimit,
                found: ids.length,
                isPrimary: i === 0
            });

            ids.forEach(id => allPubmedIds.add(id));
        }
        
        const pubmedIds = Array.from(allPubmedIds);

        // Save ingestion summary to metadata for "Inquiry Clarity"
        await updateOperation(opId, {
            metadata: {
                ...params,
                exactSearchParameters: {
                    pubmed: {
                        query: termName,
                        limit: limit,
                        startYear: startYear || null,
                        endYear: endYear || null,
                        fetchFullText: fetchFullText,
                        clusters: searchQueries
                    },
                    clinicalTrials: {
                        query: termName,
                        limit: limit,
                        clusters: searchQueries.slice(0, 4)
                    }
                },
                ingestionStats: {
                    totalClusters: searchQueries.length,
                    totalRawFound,
                    totalUniqueSaved: pubmedIds.length,
                    overlapCount: totalRawFound - pubmedIds.length,
                    clusterBreakdown: clusterStats
                }
            } as any
        });

        if (pubmedIds.length > 0) {
            const articles = await ctx.step(`Fetch details for ${pubmedIds.length} articles`, () => fetchPubMedDetails(pubmedIds, fetchFullText));
            await update(40, `Saving ${articles.length} articles...`);
            let saved = 0;
            for (let i = 0; i < articles.length; i++) {
                const art = articles[i];
                try {
                    await prisma.article.upsert({
                        where: { pubmedId_medicalTermId: { pubmedId: art.pubmedId, medicalTermId: term.id } },
                        update: {
                            title: art.title, abstractText: art.abstractText, authors: art.authors,
                            pmcId: art.pmcId, hasFullText: art.hasFullText,
                            publicationDate: art.publicationDate ? new Date(art.publicationDate) : null,
                            countryAffiliations: art.countryAffiliations,
                        },
                        create: {
                            pubmedId: art.pubmedId, pmcId: art.pmcId, hasFullText: art.hasFullText,
                            title: art.title, abstractText: art.abstractText, authors: art.authors,
                            publicationDate: art.publicationDate ? new Date(art.publicationDate) : null,
                            countryAffiliations: art.countryAffiliations,
                            medicalTermId: term.id
                        }
                    });
                    saved++;
                } catch { }
                if (i % 20 === 0 || i === articles.length - 1) {
                    await update(40 + Math.floor((i / articles.length) * 30), `Saving PubMed: ${i + 1}/${articles.length}`);
                }
            }
            await ctx.log(`✓ ${termName}: PubMed ingestion complete (${saved} articles across ${searchQueries.length} clusters).`);
        } else {
            await ctx.log(`! ${termName}: No PubMed articles found across any clusters.`);
        }

        // 3. Clinical Trials Multi-Cluster Sync
        await update(75, `Syncing Clinical Trials for ${termName} (Multi-cluster)...`);
        
        // For trials, we'll sync the original name and the top 3 keyword clusters
        const trialQueries = [termName, ...questions.slice(0, 3).map(q => q.searchKeywords)];
        
        for (let i = 0; i < trialQueries.length; i++) {
            let query = trialQueries[i];
            if (!query) continue;
            
            // Truncate safely to avoid API limits and syntax errors
            if (query.length > 120) {
                const lastSpace = query.lastIndexOf(' ', 117);
                query = (lastSpace > 50 ? query.substring(0, lastSpace) : query.substring(0, 117)).trim();
            }
            // Strip trailing special characters that might break CT syntax (like - which means NOT)
            query = query.replace(/[ \-&|()]+$/, '').trim();
            
            await update(75 + Math.floor((i / trialQueries.length) * 20), `Syncing trials cluster ${i+1}/${trialQueries.length}...`);
            try {
                await syncTrialsForMedicalTerm({ ...term, name: query }, ctx, limit);
            } catch (err: any) {
                await ctx.log(`! Warning: Failed to sync trials for cluster "${query.substring(0, 30)}...": ${err.message}`, 'WARN');
                // Continue to next cluster
            }
        }

        await update(100, `Ingestion complete for ${termName}.`);
        return term;
    };

    if (!medicalTerm) throw new Error("Medical term required");
    return await doSingleIngest(medicalTerm, 0, 100);
}

export async function executeIngestTask(opId: string, params: any) {
    await runInContext(opId, async (ctx) => {
        await ingestTaskLogic(ctx, params, opId);
    });
}
