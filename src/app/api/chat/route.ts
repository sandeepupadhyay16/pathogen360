import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLLMResponse } from '@/lib/llm';
import { buildPathogenContext, buildAggregateContext, CITATION_RULES, FORMATTING_RULES } from '@/lib/context';
import { findSemanticCache, storeSemanticCache, searchKnowledgeChunks } from '@/lib/vector';
import { generateAndSaveReport } from '@/lib/report-service';
import { pathogenResolver } from '@/lib/pathogen-resolver';
import { PARAMETERS } from '@/config/parameters';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    const startTime = performance.now();
    try {
        const { query, conversationId } = await request.json();
        let context = "";
        let mode: 'fast' | 'detailed' = 'fast'; 
        let sources: any[] = [];
        const isPdfRequest = query?.toLowerCase().includes('pdf') || query?.toLowerCase().includes('download') || query?.toLowerCase().includes('report in pdf');

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        // 1. Load data first to avoid reference errors
        const pathogens = await prisma.pathogen.findMany({
            include: {
                articles: { take: PARAMETERS.DATA_FETCHING.MAX_ARTICLES, orderBy: { publicationDate: 'desc' } },
                clinicalTrials: { take: PARAMETERS.DATA_FETCHING.MAX_TRIALS, orderBy: { startDate: 'desc' } },
                reports: { take: 1, orderBy: { createdAt: 'desc' } },
                epidemiologyMetrics: { take: PARAMETERS.DATA_FETCHING.MAX_EPI_METRICS, orderBy: { year: 'desc' } },
                surveillanceAlerts: { take: PARAMETERS.DATA_FETCHING.MAX_SURVEILLANCE_ALERTS, orderBy: { publishedAt: 'desc' } }
            }
        });

        const totalPathogens = await prisma.pathogen.count();
        const synthesizedPathogens = pathogens.filter(p => !!p.synthesizedContext).length;
        const dbLoadTime = performance.now();

        // 2. Resolve Pathogen Name
        const resolutionStartTime = performance.now();
        const resolution = await pathogenResolver.resolve(query);
        const resolutionEndTime = performance.now();
        const resolvedQuery = resolution.found ? resolution.canonicalName : query;
        let resolvedPathogenId = null;
        if (resolution.found) {
            const matchedInDb = pathogens.find(p => p.name === resolution.canonicalName);
            resolvedPathogenId = matchedInDb?.id || null;
            console.log(`Pathogen Resolution: "${query}" -> "${resolution.canonicalName}" (ID: ${resolvedPathogenId || 'NOT_IN_DB'}, Confidence: ${resolution.confidence.toFixed(2)})`);
        }

        // 3. Handle Persistence
        let currentConversationId = conversationId;
        if (!currentConversationId) {
            const conversation = await prisma.conversation.create({
                data: { title: query.substring(0, 50) + (query.length > 50 ? '...' : '') }
            });
            currentConversationId = conversation.id;
        }

        await prisma.message.create({
            data: {
                conversationId: currentConversationId,
                role: 'user',
                content: query
            }
        });

        // 4. Determine intent using LLM router
        const registryData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/config/pathogen-registry.json'), 'utf8'));
        const registryList = registryData.pathogens || [];
        const registryContext = totalPathogens === 0
            ? `REGISTRY (Valid pathogens available for onboarding):\n${registryList.join(', ')}`
            : '';

        const messageHistory = await prisma.message.findMany({
            where: { conversationId: currentConversationId },
            orderBy: { createdAt: 'asc' },
            take: 10
        });

        const formattedHistory = messageHistory.map(m => ({
            role: (m.role === 'ai' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
            content: m.content
        }));

        const intentPrompt = `You are the primary Semantic Router for the AI Research Agent.
Your job is to classify the user's intent into one of the following specific routes.

System Status: ${totalPathogens} pathogens onboarded, ${synthesizedPathogens} synthesized.

AVAILABLE ROUTES:
- [ID]: Return the UUID of the pathogen if the query is strictly about a single pathogen already in the database.
- UNRECOGNIZED: [Name]: Return if the pathogen is in the REGISTRY but NOT in the database.
- FAMILY: [FamilyName]: Use if the query is specifically about a virus/bacteria family.
- GENERAL: Use ONLY for broad queries that involve comparisons across the entire portfolio, general system questions, or discovery of new trends where no specific pathogen is mentioned.
- CROSS_PATHOGEN: [Keywords]: ONLY use for specific comparisons between explicitly named groups (e.g., "respiratory viruses", "bacterial cocci").
- CLARIFY: [Message]: If the intent is truly orphaned or nonsensical.

RESOLVED PATHOGEN TARGET: ${resolution.found ? `${resolution.canonicalName} (ID: ${resolvedPathogenId || 'NOT_IN_DB'})` : 'NONE'}

ONBOARDED DATABASE ENTRIES:
${pathogens.map(p => `- ${p.name} (ID: ${p.id})`).join('\n') || 'NONE'}

STRICT RESPONSE FORMAT:
Return ONLY a JSON object with these keys:
{
  "route": "The route name or UUID",
  "mode": "fast" | "detailed",
  "primaryTopic": "epidemiology" | "clinical_trials" | "articles" | "general",
  "reasoning": "A short sentence explaining why this route was chosen."
}

ROUTING RULES:
1. If RESOLVED PATHOGEN TARGET has an ID and the query is about that single pathogen, use that ID. This takes absolute precedence over GENERAL.
2. If RESOLVED PATHOGEN TARGET is found in the Registry but NOT in the Database (ID is NOT_IN_DB), you MUST use "UNRECOGNIZED: [CanonicalName]".
3. DO NOT use GENERAL for specific data requests (epidemiology, articles, trials) if a specific pathogen or family can be identified.
4. If user asks about prevalence, incidence, outbreaks, or GHO data, set "primaryTopic" to "epidemiology".
5. If user asks "Which pathogens have X?", "What are the latest outbreaks?", or "Where is the most unmet need?", use GENERAL.
6. If a specific pathogen name (e.g. "Chikungunya", "SARS-CoV-2") is in the query, DO NOT use GENERAL. Use the Pathogen's ID.
`;

        const routerStartTime = performance.now();
        const llmMatchResponse = await generateLLMResponse([
            { role: 'system', content: intentPrompt },
            ...formattedHistory
        ], 0);
        const routerEndTime = performance.now();

        let llmMatch = "GENERAL";
        let agentReasoning = "Determining the best path to answer your query.";
        let primaryTopic = "general";
        
        try {
            const cleanContent = llmMatchResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            llmMatch = parsed.route || "GENERAL";
            mode = (parsed.mode?.toLowerCase() === 'detailed' ? 'detailed' : 'fast') as 'fast' | 'detailed';
            primaryTopic = parsed.primaryTopic || "general";
            agentReasoning = parsed.reasoning || agentReasoning;

            // PROGRAMMATIC SAFEGUARD: If we have a high-confidence resolution with an ID, 
            // and the LLM still chose GENERAL, override it if the pathogen name is in the query.
            if (llmMatch === "GENERAL" && resolution.found && resolvedPathogenId) {
                const pathogenName = resolution.canonicalName.toLowerCase();
                const lowerQuery = query.toLowerCase();
                if (lowerQuery.includes(pathogenName) || pathogenName.split(' ').some(word => word.length > 3 && lowerQuery.includes(word))) {
                    console.log(`Programmatic Routing Override: GENERAL -> ${resolvedPathogenId} (Pathogen detected: ${resolution.canonicalName})`);
                    llmMatch = resolvedPathogenId;
                    agentReasoning = `Programmatically rerouted to ${resolution.canonicalName} based on strong name match in query.`;
                }
            }
        } catch (e) {
            console.warn("Failed to parse router JSON, falling back to substring search:", e);
            llmMatch = llmMatchResponse.content.includes('GENERAL') ? 'GENERAL' : (llmMatchResponse.content.split('|')[0] || "GENERAL");
        }
        
        const routingUsage = llmMatchResponse.usage;

        console.log(`Routing: ${llmMatch} | Mode: ${mode} | Topic: ${primaryTopic} | Reasoning: ${agentReasoning}`);

        // Diagnostic routing path
        const diagnosticPath: any[] = [
            { 
                stepId: "query", 
                label: "Query Received", 
                status: "info", 
                value: query,
                durationMs: 0
            },
            { 
                stepId: "db_load", 
                label: "DB Cold Start / Preload", 
                status: "success", 
                value: `${pathogens.length} pathogens`,
                durationMs: Math.round(dbLoadTime - startTime)
            },
            { 
                stepId: "resolution", 
                label: "Pathogen Resolution", 
                status: resolution.found ? "success" : "warning", 
                value: resolution.found ? resolution.canonicalName : "NOT_FOUND",
                durationMs: Math.round(resolutionEndTime - resolutionStartTime),
                metadata: { confidence: resolution.confidence }
            },
            { 
                stepId: "router", 
                label: "LLM Route Selection", 
                status: "success", 
                value: llmMatch,
                durationMs: Math.round(routerEndTime - routerStartTime),
                metadata: { reasoning: agentReasoning, topic: primaryTopic }
            },
            { 
                stepId: "context", 
                label: "Context Assembly", 
                status: "success", 
                value: "Data Assembled",
                durationMs: 0 // Will be updated
            },
            { 
                stepId: "cache", 
                label: "Cache Check", 
                status: mode === "fast" ? "info" : "warning", 
                value: mode,
                durationMs: 0 // Will be updated
            }
        ];
        
        const contextStartTime = performance.now();

        let matchedPathogens: any[] = [];
        let matchedPathogen = null;
        let noMatchMessage = null;
        let unrecognizedPathogen = null;
        let visuals: any = null;

        if (llmMatch.startsWith('CLARIFY:')) {
            noMatchMessage = llmMatch.replace('CLARIFY:', '').trim();
        } else if (llmMatch.startsWith('UNRECOGNIZED:')) {
            unrecognizedPathogen = llmMatch.replace('UNRECOGNIZED:', '').trim();
            noMatchMessage = `I don't have any data for **${unrecognizedPathogen}** in the Pathogen 360 knowledge base yet. Would you like to onboard it?`;
        } else if (llmMatch === 'GENERAL') {
            const aggregate = buildAggregateContext(pathogens, "Global Market & Outbreak Intelligence");
            context = aggregate.context;
            sources.push(...aggregate.sources);
            visuals = aggregate.visuals;
            if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';
        } else if (llmMatch.startsWith('FAMILY:')) {
            const familyName = llmMatch.replace('FAMILY:', '').trim();
            matchedPathogens = pathogens.filter(p => 
                (p.family || '').toLowerCase().includes(familyName.toLowerCase()) || 
                (p.taxonomy || '').toLowerCase().includes(familyName.toLowerCase()) ||
                (p.name || '').toLowerCase().includes(familyName.toLowerCase())
            );
            if (matchedPathogens.length === 0) {
                noMatchMessage = `I couldn't find any pathogens belonging to the **${familyName}** family in our database.`;
            } else {
                const aggregate = buildAggregateContext(matchedPathogens, `Family: ${familyName}`);
                context = aggregate.context;
                sources.push(...aggregate.sources);
                visuals = aggregate.visuals;
                if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';
            }
        } else if (llmMatch.startsWith('CROSS_PATHOGEN:')) {
            const filter = llmMatch.replace('CROSS_PATHOGEN:', '').trim().toLowerCase();
            const keywords = filter.split(/[\s,]+/).filter(k => k.length > 2);
            
            matchedPathogens = pathogens.filter(p => {
                const searchStr = `${p.name} ${p.family} ${p.taxonomy}`.toLowerCase();
                return keywords.some(k => searchStr.includes(k));
            });

            if (matchedPathogens.length === 0) {
                console.log(`CROSS_PATHOGEN filter "${filter}" returned 0 results. Falling back to GENERAL context.`);
                const aggregate = buildAggregateContext(pathogens, "Global Database Context (Fallback)");
                context = aggregate.context;
                sources.push(...aggregate.sources);
                visuals = aggregate.visuals;
            } else {
                const aggregate = buildAggregateContext(matchedPathogens, `Comparison: ${filter}`);
                context = aggregate.context;
                sources.push(...aggregate.sources);
                visuals = aggregate.visuals;
            }
            if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';
        } else {
            const exactId = llmMatch.trim();
            matchedPathogen = pathogens.find((p: any) => p.id === exactId);
            if (!matchedPathogen) {
                const lowerQuery = query.toLowerCase();
                matchedPathogen = pathogens.find((p: any) => p.name.toLowerCase().includes(lowerQuery) || lowerQuery.includes(p.name.toLowerCase()));
            }
        }

        if (matchedPathogen) {
            console.log(`Matched pathogen: ${matchedPathogen.name} (ID: ${matchedPathogen.id})`);
            const structuredRes = buildPathogenContext(matchedPathogen);
            sources.push(...structuredRes.sources);
            visuals = structuredRes.visuals;
            if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';

            // Detection for "formatting" or "length" instructions that require fresh generation
            const hasFormattingInstruction = /paragraph|summary|list|table|bullets|bullet points|concise|detailed|format|report|write a|provide a/i.test(query);
            
            if (mode === 'fast' && !hasFormattingInstruction) {
                const cachedResponse = await findSemanticCache(query, matchedPathogen.id);
                if (cachedResponse) {
                    const finalReply = cachedResponse + "\n\n*(Retrieved from cache)*";
                    diagnosticPath[4].durationMs = Math.round(performance.now() - contextStartTime);
                    diagnosticPath[5].metadata = { hit: true };

                    await prisma.message.create({
                        data: {
                            conversationId: currentConversationId,
                            role: 'ai',
                            content: finalReply,
                            reasoning: agentReasoning,
                            usage: routingUsage as any,
                            routingPath: diagnosticPath as any,
                            diagnostic: {
                                pathogenResolution: diagnosticPath[2],
                                routeSelection: diagnosticPath[3],
                                contextAssembly: diagnosticPath[4],
                                cacheCheck: diagnosticPath[5],
                                totalDurationMs: Math.round(performance.now() - startTime)
                            } as any
                        }
                    });
                    return NextResponse.json({
                        answer: finalReply,
                        matchedPathogen: matchedPathogen.name,
                        pathogenId: matchedPathogen.id,
                        sources: [],
                        conversationId: currentConversationId,
                        usage: routingUsage,
                        reasoning: agentReasoning,
                        visuals: visuals,
                        routingPath: diagnosticPath,
                        diagnostic: {
                            pathogenResolution: diagnosticPath[2],
                            routeSelection: diagnosticPath[3],
                            contextAssembly: diagnosticPath[4],
                            cacheCheck: diagnosticPath[5],
                            totalDurationMs: Math.round(performance.now() - startTime)
                        }
                    });
                }
                context = structuredRes.context;
            } else {
                const chunks = await searchKnowledgeChunks(query, matchedPathogen.id, PARAMETERS.RAG.MAX_KNOWLEDGE_CHUNKS);
                let ragContext = "";
                if (chunks.length > 0) {
                    const nextRefIndex = Math.max(...sources.map(s => s.refIndex || 0)) + 1;
                    const chunkRefs: any[] = [];
                    ragContext = "RELEVANT GROUND TRUTH (RAG - Semantic Search Results):\n";
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const refIndex = nextRefIndex + i;
                        let title = "Supporting Data";
                        let authors = "";
                        let date = null;

                        if (chunk.sourceType === 'ARTICLE') {
                            const article = matchedPathogen.articles.find((a: any) => a.id === chunk.sourceId);
                            if (article) {
                                title = article.title;
                                authors = article.authors ?? "";
                                date = article.publicationDate;
                            } else {
                                title = `PubMed Article ${chunk.sourceId}`;
                            }
                        } else if (chunk.sourceType === 'TRIAL') {
                            const trial = matchedPathogen.clinicalTrials.find((t: any) => t.id === chunk.sourceId);
                            if (trial) {
                                title = trial.title;
                                date = trial.startDate;
                            } else {
                                title = `Clinical Trial ${chunk.sourceId}`;
                            }
                        }

                        chunkRefs.push({
                            id: chunk.sourceId,
                            type: chunk.sourceType.toLowerCase() === 'trial' ? 'clinical_trial' : 'article',
                            title,
                            authors,
                            date,
                            refIndex
                        });
                        ragContext += `[REF ${refIndex}] Source: ${chunk.sourceType} (${chunk.sourceId})\nContent: ${chunk.content}\n\n`;
                    }
                    sources.push(...chunkRefs);
                }
                context = `${ragContext}\n\n--- STRUCTURED KNOWLEDGE BASE (Baseline Data) ---\n${structuredRes.context}`;
            }
        }

        context += `\n\n${CITATION_RULES}\n${FORMATTING_RULES}`;

        if (noMatchMessage) {
            const currentDiagnosticData = {
                pathogenResolution: diagnosticPath[2],
                routeSelection: diagnosticPath[3],
                contextAssembly: diagnosticPath[4],
                cacheCheck: diagnosticPath[5],
                totalDurationMs: Math.round(performance.now() - startTime)
            };

            await prisma.message.create({
                data: { 
                    conversationId: currentConversationId, 
                    role: 'ai', 
                    content: noMatchMessage,
                    reasoning: agentReasoning,
                    usage: routingUsage as any,
                    routingPath: diagnosticPath as any,
                    diagnostic: currentDiagnosticData as any
                }
            });
            return NextResponse.json({ 
                answer: noMatchMessage, 
                conversationId: currentConversationId, 
                usage: routingUsage, 
                reasoning: agentReasoning,
                unrecognizedPathogen: unrecognizedPathogen,
                routingPath: diagnosticPath,
                diagnostic: currentDiagnosticData
            });
        }

        const systemPrompt = `You are a pharmaceutical strategist. Use ONLY the provided context.
STRICT FORMATTING:
1. Use Markdown tables for comparisons.
2. Cite all claims using [N].
3. If asked for a "market report", provide a comprehensive summary including investment gaps and potential.

Context: 
${context}
`;

        const contextEndTime = performance.now();
        diagnosticPath[4].durationMs = Math.round(contextEndTime - contextStartTime);

        const inferStartTime = performance.now();
        const response = await generateLLMResponse([
            { role: 'system', content: systemPrompt },
            ...formattedHistory
        ], 0.1);
        const inferEndTime = performance.now();

        const totalUsage = {
            prompt_tokens: (routingUsage?.prompt_tokens || 0) + response.usage.prompt_tokens,
            completion_tokens: (routingUsage?.completion_tokens || 0) + response.usage.completion_tokens,
            total_tokens: (routingUsage?.total_tokens || 0) + response.usage.total_tokens
        };

        diagnosticPath.push({
            stepId: "inference",
            label: "Final Inference",
            status: "success",
            value: `${response.usage.completion_tokens} tokens`,
            durationMs: Math.round(inferEndTime - inferStartTime)
        });

        const finalDiagnosticData = {
            pathogenResolution: diagnosticPath[2],
            routeSelection: diagnosticPath[3],
            contextAssembly: diagnosticPath[4],
            cacheCheck: diagnosticPath[5],
            inference: diagnosticPath[6],
            totalDurationMs: Math.round(performance.now() - startTime)
        };

        await prisma.message.create({
            data: { 
                conversationId: currentConversationId, 
                role: 'ai', 
                content: response.content,
                reasoning: agentReasoning,
                usage: totalUsage as any,
                routingPath: diagnosticPath as any,
                diagnostic: finalDiagnosticData as any
            }
        });

        if (matchedPathogen && mode === 'fast') {
            await storeSemanticCache(resolvedQuery, response.content, matchedPathogen.id);
        }

        let reportId = null;
        if (isPdfRequest && matchedPathogen) {
            try {
                const report = await generateAndSaveReport(matchedPathogen.id);
                reportId = report.id;
            } catch (err) {
                console.error("Failed to auto-generate report:", err);
            }
        }

        return NextResponse.json({
            diagnostic: finalDiagnosticData,
            routingPath: diagnosticPath,
            answer: response.content,
            matchedPathogen: matchedPathogen ? matchedPathogen.name : null,
            pathogenId: matchedPathogen ? matchedPathogen.id : null,
            reportId,
            sources,
            visuals: visuals || (matchedPathogen as any)?.visualData || null,
            conversationId: currentConversationId,
            reasoning: agentReasoning,
            usage: totalUsage
        });

    } catch (error: any) {
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
