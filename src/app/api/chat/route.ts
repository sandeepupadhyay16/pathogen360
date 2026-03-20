import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLLMResponse, streamLLMResponse } from '@/lib/llm';
import { buildMedicalTermContext, buildAggregateMedicalContext, CITATION_RULES, FORMATTING_RULES } from '@/lib/context';
import { findSemanticCache, storeSemanticCache, searchKnowledgeChunks } from '@/lib/vector';
import { medicalTermResolver } from '@/lib/medical-term-resolver';
import { PARAMETERS } from '@/config/parameters';

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
        // 1. Load basic medical terms data first (Lightweight)
        const medicalTerms = await prisma.medicalTerm.findMany({
            select: { id: true, name: true, category: true, synthesizedContext: true }
        });

        const totalTerms = await prisma.medicalTerm.count();
        const synthesizedTerms = medicalTerms.filter(p => !!p.synthesizedContext).length;
        const dbLoadTime = performance.now();

        // 2. Resolve Medical Term Name
        const resolutionStartTime = performance.now();
        const resolution = await medicalTermResolver.resolve(query);
        const resolutionEndTime = performance.now();
        const resolvedQuery = resolution.found ? resolution.canonicalName : query;
        let resolvedTermId = null;
        if (resolution.found) {
            const matchedInDb = medicalTerms.find(p => p.name === resolution.canonicalName);
            resolvedTermId = matchedInDb?.id || null;
            console.log(`Medical Term Resolution: "${query}" -> "${resolution.canonicalName}" (ID: ${resolvedTermId || 'NOT_IN_DB'}, Confidence: ${resolution.confidence.toFixed(2)})`);
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

System Status: ${totalTerms} medical terms onboarded, ${synthesizedTerms} synthesized.

AVAILABLE ROUTES:
- [ID]: Return the UUID of the medical term if the query is strictly about a single entity already in the database.
- UNRECOGNIZED: [Name]: Return if the query refers to a specific medical entity, disease, drug, or medical term that is NOT in the ONBOARDED DATABASE ENTRIES natively. If a recognized term can be derived, use the specific name.
- CATEGORY: [CategoryName]: Use if the query is specifically about a category/class of medical terms (e.g. drug class, virus family).
- GENERAL: Use ONLY for broad queries that involve comparisons across the entire portfolio, general system questions, or discovery of new trends where no specific term is mentioned.
- CROSS_ENTITY: [Keywords]: ONLY use for specific comparisons between explicitly named groups (e.g., "respiratory viruses", "check-point inhibitors").
- CLARIFY: [Message]: If the intent is truly orphaned or nonsensical.

RESOLVED TARGET: ${resolution.found ? `${resolution.canonicalName} (ID: ${resolvedTermId || 'NOT_IN_DB'})` : 'NONE'}

ONBOARDED DATABASE ENTRIES:
${medicalTerms.map(p => `- ${p.name} (ID: ${p.id})`).join('\n') || 'NONE'}

ROUTING RULES (STRICT):
1. If the user mentions a specific medical term (e.g. "NSCLC", "Diabetes", "ALS") that is in the ONBOARDED DATABASE ENTRIES, YOU MUST USE ITS UUID AS THE ROUTE.
2. If RESOLVED TARGET has an ID, USE IT. This takes absolute precedence over GENERAL.
3. Use UNRECOGNIZED: [Name] ONLY if the term is clearly a specific medical entity but is NOT in the database list.
4. Use GENERAL ONLY for meta-questions about the system, broad dataset comparisons (e.g. "which terms have most articles?"), or UI navigation help.
5. If the query is "How many cases of NSCLC?", it IS about NSCLC. Use its UUID.
6. If the query is "Tell me about virus outbreaks", and no specific virus is named, use GENERAL.

STRICT RESPONSE FORMAT:
Return ONLY a JSON object:
{
  "route": "The UUID or route name",
  "mode": "fast" | "detailed",
  "primaryTopic": "epidemiology" | "clinical_trials" | "articles" | "general",
  "reasoning": "Context for choice."
}
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
            // and the LLM still chose GENERAL or UNRECOGNIZED, override it if the name is in the query.
            if ((llmMatch === "GENERAL" || llmMatch.startsWith("UNRECOGNIZED:")) && resolution.found && resolvedTermId) {
                const termName = resolution.canonicalName.toLowerCase();
                const lowerQuery = query.toLowerCase();
                if (lowerQuery.includes(termName) || 
                    termName.split(' ').some((word: string) => word.length > 3 && lowerQuery.includes(word)) ||
                    (resolution.confidence > 0.95)) {
                    console.log(`Programmatic Routing Override: ${llmMatch} -> ${resolvedTermId} (Term detected: ${resolution.canonicalName})`);
                    llmMatch = resolvedTermId;
                    agentReasoning = `Programmatically rerouted to ${resolution.canonicalName} based on strong match (Conf: ${resolution.confidence.toFixed(2)}).`;
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
                value: `${medicalTerms.length} Medical Terms`,
                durationMs: Math.round(dbLoadTime - startTime)
            },
            { 
                stepId: "resolution", 
                label: "Medical Term Resolution", 
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

        let matchedMedicalTerms: any[] = [];
        let matchedTerm = null;
        let noMatchMessage = null;
        let unrecognizedTerm = null;
        let visuals: any = null;

        if (llmMatch.startsWith('CLARIFY:')) {
            noMatchMessage = llmMatch.replace('CLARIFY:', '').trim();
        } else if (llmMatch.startsWith('UNRECOGNIZED:')) {
            unrecognizedTerm = llmMatch.replace('UNRECOGNIZED:', '').trim();
            noMatchMessage = `I don't have any data for **${unrecognizedTerm}** in the Medical 360 knowledge base yet. Would you like to onboard it?`;
        } else if (llmMatch === 'GENERAL') {
            const aggregate = buildAggregateMedicalContext(medicalTerms, "Global Market & Outbreak Intelligence");
            context = aggregate.context;
            sources.push(...aggregate.sources);
            visuals = aggregate.visuals;
            if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';
        } else if (llmMatch.startsWith('CATEGORY:')) {
            const familyName = llmMatch.replace('CATEGORY:', '').trim();
            matchedMedicalTerms = medicalTerms.filter(p => 
                (p.category || '').toLowerCase().includes(familyName.toLowerCase()) || 
                (p.name || '').toLowerCase().includes(familyName.toLowerCase())
            );
            if (matchedMedicalTerms.length === 0) {
                noMatchMessage = `I couldn't find any medical terms belonging to the **${familyName}** category in our database.`;
            } else {
                const aggregate = buildAggregateMedicalContext(matchedMedicalTerms, `Category: ${familyName}`);
                context = aggregate.context;
                sources.push(...aggregate.sources);
                visuals = aggregate.visuals;
                if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';
            }
        } else if (llmMatch.startsWith('CROSS_ENTITY:')) {
            const filter = llmMatch.replace('CROSS_ENTITY:', '').trim().toLowerCase();
            const keywords = filter.split(/[\s,]+/).filter(k => k.length > 2);
            
            matchedMedicalTerms = medicalTerms.filter(p => {
                const searchStr = `${p.name} ${p.category}`.toLowerCase();
                return keywords.some(k => searchStr.includes(k));
            });

            if (matchedMedicalTerms.length === 0) {
                console.log(`CROSS_ENTITY filter "${filter}" returned 0 results. Falling back to GENERAL context.`);
                const aggregate = buildAggregateMedicalContext(medicalTerms, "Global Database Context (Fallback)");
                context = aggregate.context;
                sources.push(...aggregate.sources);
                visuals = aggregate.visuals;
            } else {
                const aggregate = buildAggregateMedicalContext(matchedMedicalTerms, `Comparison: ${filter}`);
                context = aggregate.context;
                sources.push(...aggregate.sources);
                visuals = aggregate.visuals;
            }
            if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';
        } else {
            const exactId = llmMatch.trim();
            let matchedTermRef = medicalTerms.find((p: any) => p.id === exactId);
            if (!matchedTermRef) {
                const lowerQuery = query.toLowerCase();
                matchedTermRef = medicalTerms.find((p: any) => p.name.toLowerCase().includes(lowerQuery) || lowerQuery.includes(p.name.toLowerCase()));
            }

            if (matchedTermRef) {
                // Fetch full data for the matched term ONLY
                matchedTerm = await prisma.medicalTerm.findUnique({
                    where: { id: matchedTermRef.id },
                    include: {
                        articles: { take: PARAMETERS.DATA_FETCHING.MAX_ARTICLES, orderBy: { publicationDate: 'desc' } },
                        clinicalTrials: { take: PARAMETERS.DATA_FETCHING.MAX_TRIALS, orderBy: { startDate: 'desc' } },
                        metrics: { take: PARAMETERS.DATA_FETCHING.MAX_EPI_METRICS, orderBy: { year: 'desc' } },
                        surveillanceAlerts: { take: PARAMETERS.DATA_FETCHING.MAX_SURVEILLANCE_ALERTS, orderBy: { publishedAt: 'desc' } }
                    }
                });
            }
        }

        if (matchedTerm) {
            console.log(`Matched medical term: ${matchedTerm.name} (ID: ${matchedTerm.id})`);
            const structuredRes = buildMedicalTermContext(matchedTerm);
            sources.push(...structuredRes.sources);
            visuals = structuredRes.visuals;
            if (primaryTopic === 'epidemiology' && visuals) visuals.primaryVisual = 'epidemiology';

            // Detection for "formatting" or "length" instructions that require fresh generation
            const hasFormattingInstruction = /paragraph|summary|list|table|bullets|bullet points|concise|detailed|format|report|write a|provide a/i.test(query);
            
            if (mode === 'fast' && !hasFormattingInstruction) {
                const cachedResponse = await findSemanticCache(query, matchedTerm.id);
                if (cachedResponse) {
                    const finalReply = cachedResponse.response + "\n\n*(Retrieved from cache)*";
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
                            sources: cachedResponse.sources as any,
                            diagnostic: {
                                medicalTermResolution: diagnosticPath[2],
                                routeSelection: diagnosticPath[3],
                                contextAssembly: diagnosticPath[4],
                                cacheCheck: diagnosticPath[5],
                                totalDurationMs: Math.round(performance.now() - startTime)
                            } as any
                        }
                    });
                    return NextResponse.json({
                        answer: finalReply,
                        matchedMedicalTerm: matchedTerm.name,
                        medicalTermId: matchedTerm.id,
                        sources: cachedResponse.sources,
                        conversationId: currentConversationId,
                        usage: routingUsage,
                        reasoning: agentReasoning,
                        visuals: visuals,
                        routingPath: diagnosticPath,
                        diagnostic: {
                            medicalTermResolution: diagnosticPath[2],
                            routeSelection: diagnosticPath[3],
                            contextAssembly: diagnosticPath[4],
                            cacheCheck: diagnosticPath[5],
                            totalDurationMs: Math.round(performance.now() - startTime)
                        }
                    });
                }
                context = structuredRes.context;
            } else {
                const chunks = await searchKnowledgeChunks(query, matchedTerm.id, PARAMETERS.RAG.MAX_KNOWLEDGE_CHUNKS);
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
                            const article = matchedTerm.articles.find((a: any) => a.id === chunk.sourceId);
                            if (article) {
                                title = article.title;
                                authors = article.authors ?? "";
                                date = article.publicationDate;
                            } else {
                                title = `PubMed Article ${chunk.sourceId}`;
                            }
                        } else if (chunk.sourceType === 'TRIAL') {
                            const trial = matchedTerm.clinicalTrials.find((t: any) => t.id === chunk.sourceId);
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
                medicalTermResolution: diagnosticPath[2],
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
                    sources: [] as any,
                    diagnostic: currentDiagnosticData as any
                }
            });
            return NextResponse.json({ 
                answer: noMatchMessage, 
                conversationId: currentConversationId, 
                usage: routingUsage, 
                reasoning: agentReasoning,
                unrecognizedTerm: unrecognizedTerm,
                routingPath: diagnosticPath,
                diagnostic: currentDiagnosticData
            });
        }

        const systemPrompt = `You are Medical360, an elite Medical Intelligence Analyst. Use ONLY the provided context to answer the user query.
STRICT FORMATTING RULES:
1. Use Markdown tables for comparisons.
2. Cite all claims using [N].
3. If asked for a "market report" or "analysis", provide a comprehensive summary including clinical gaps, development pipeline, mechanism of action, and potential impact.

Context: 
${context}
`;

        const contextEndTime = performance.now();
        diagnosticPath[4].durationMs = Math.round(contextEndTime - contextStartTime);

        // --- NEW: STREAMING RESPONSE ---
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // 1. Send initial metadata chunk
                    const initialData = {
                        type: 'metadata',
                        conversationId: currentConversationId,
                        matchedMedicalTerm: matchedTerm ? matchedTerm.name : null,
                        medicalTermId: matchedTerm ? matchedTerm.id : null,
                        sources: sources,
                        visuals: visuals || (matchedTerm as any)?.visualData || null,
                        reasoning: agentReasoning,
                        routingPath: diagnosticPath,
                        diagnostic: {
                            medicalTermResolution: diagnosticPath[2],
                            routeSelection: diagnosticPath[3],
                            contextAssembly: diagnosticPath[4],
                            cacheCheck: diagnosticPath[5],
                        }
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(initialData) + '\n'));

                    // 2. Start LLM stream
                    const streamBody = await streamLLMResponse([
                        { role: 'system', content: systemPrompt },
                        ...formattedHistory
                    ], 0.1);

                    if (!streamBody) {
                        throw new Error("Failed to start LLM stream");
                    }

                    const reader = streamBody.getReader();
                    let fullContent = "";
                    let completionTokens = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = new TextDecoder().decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
                            
                            if (trimmedLine.startsWith('data: ')) {
                                try {
                                    const jsonStr = trimmedLine.slice(6);
                                    const data = JSON.parse(jsonStr);
                                    
                                    // Handle different formats (OpenAI, Anthropic, etc. often used by proxies)
                                    const content = data.choices?.[0]?.delta?.content || 
                                                  data.choices?.[0]?.text || 
                                                  data.delta?.content || 
                                                  "";
                                                  
                                    if (content) {
                                        fullContent += content;
                                        completionTokens++;
                                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', content }) + '\n'));
                                    }
                                } catch (e) {
                                    // Partial JSON or heartbeat
                                }
                            }
                        }
                    }

                    // 3. Finalize and Save to DB
                    const totalUsage = {
                        prompt_tokens: (routingUsage?.prompt_tokens || 0), // Simplifying usage for streaming
                        completion_tokens: completionTokens,
                        total_tokens: (routingUsage?.total_tokens || 0) + completionTokens
                    };

                    const finalDiagnosticData = {
                        ...initialData.diagnostic,
                        totalDurationMs: Math.round(performance.now() - startTime)
                    };

                    await prisma.message.create({
                        data: { 
                            conversationId: currentConversationId, 
                            role: 'ai', 
                            content: fullContent,
                            reasoning: agentReasoning,
                            usage: totalUsage as any,
                            routingPath: diagnosticPath as any,
                            sources: sources as any,
                            diagnostic: finalDiagnosticData as any
                        }
                    });

                    if (matchedTerm && mode === 'fast') {
                        await storeSemanticCache(resolvedQuery, fullContent, sources, matchedTerm.id);
                    }

                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', usage: totalUsage }) + '\n'));
                    controller.close();
                } catch (err: any) {
                    console.error("Streaming Error:", err);
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: err.message }) + '\n'));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("CRITICAL API ERROR:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
