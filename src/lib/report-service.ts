import { prisma } from './prisma';
import { generateLLMResponse } from './llm';

export async function generateAndSaveReport(pathogenId: string) {
    const pathogen = await prisma.pathogen.findUnique({
        where: { id: pathogenId },
        include: {
            articles: {
                take: 50,
                orderBy: { publicationDate: 'desc' }
            }
        }
    });

    if (!pathogen) {
        throw new Error('Pathogen not found');
    }

    // Map-Reduce approach for summaries
    const MAX_CHUNK_CHARS = 100000;
    const chunks: string[] = [];
    let currentChunk = '';

    for (let i = 0; i < pathogen.articles.length; i++) {
        const a = pathogen.articles[i];
        const abstractText = a.abstractText ? a.abstractText : 'No abstract available';
        const articleStr = `[REF ${i + 1}] [Article: ${a.pubmedId}]\nTitle: ${a.title}\nAuthors: ${a.authors}\nAbstract: ${abstractText}\n\n---\n\n`;

        if ((currentChunk.length + articleStr.length) > MAX_CHUNK_CHARS && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = articleStr;
        } else {
            currentChunk += articleStr;
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    let synthesizedContext = '';
    for (let i = 0; i < chunks.length; i++) {
        const chunkPrompt = `You are an AI assistant. Summarize the following articles relevant to the pathogen '${pathogen.name}'.
Extract key facts regarding taxonomy, epidemiology, target populations, vaccines, and market gaps.
STRICTLY MAINTAIN INLINE CITATIONS like [REF N].
        
Articles:
${chunks[i]}`;

        const { content: chunkSummary } = await generateLLMResponse([
            { role: 'user', content: chunkPrompt }
        ], 0.3);
        synthesizedContext += `\n\n--- Chunk ${i + 1} Summary ---\n\n${chunkSummary}`;
    }

    const systemPrompt = `You are a specialized Medical & Business Intelligence AI for a U.S. pharmaceutical firm's vaccine division. 
Your task is to generate a comprehensive Market Report for the pathogen '${pathogen.name}' based on the provided synthesized summaries.
Target countries: USA, Germany, Japan, UK.

STRICT CITATION RULES:
1. Every factual statement must be followed by an inline numbered citation like [1], [2], or [1,3,5] that points to the specific raw source article [REF N].
2. Use the index N from the [REF N] tags provided in the Context Data.
3. NEVER use [KN] or reference the "Knowledge Nucleus".

You must format your response exactly with these 5 headings:
1. Pathogen Taxonomy & Biology
2. Epidemiology in Target Countries
3. Target Population Size & Demographics
4. Current Vaccine Landscape (Approved & Pipeline)
5. Market Potential Estimate & Investment Gaps

Context Data:
${synthesizedContext}`;

    const { content: generatedReportText } = await generateLLMResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate the report for ${pathogen.name}.` }
    ], 0.7);

    if (generatedReportText.includes("unable to reach the local language model")) {
        throw new Error('LLM Server Offline');
    }

    const sections = generatedReportText.split(/(?=\d\.)/g);
    let epidemiology = '';
    let populationSize = '';
    let vaccineLandscape = '';
    let marketPotential = '';
    let investmentGaps = '';
    let taxonomy = '';

    for (const section of sections) {
        if (/1\.\s+pathogen/i.test(section)) taxonomy = section.replace(/1\.\s+[^\n]+\n/, '').trim();
        if (/2\.\s+epidemiology/i.test(section)) epidemiology = section.replace(/2\.\s+[^\n]+\n/, '').trim();
        if (/3\.\s+target/i.test(section)) populationSize = section.replace(/3\.\s+[^\n]+\n/, '').trim();
        if (/4\.\s+current/i.test(section)) vaccineLandscape = section.replace(/4\.\s+[^\n]+\n/, '').trim();
        if (/5\.\s+market/i.test(section)) {
            marketPotential = section.replace(/5\.\s+[^\n]+\n/, '').trim();
            investmentGaps = marketPotential;
        }
    }

    const report = await prisma.marketReport.create({
        data: {
            pathogenId: pathogen.id,
            epidemiology: epidemiology || generatedReportText,
            populationSize,
            marketPotential,
            investmentGaps,
            vaccineLandscape
        }
    });

    if (!pathogen.taxonomy && taxonomy) {
        await prisma.pathogen.update({
            where: { id: pathogen.id },
            data: { taxonomy, biology: taxonomy }
        });
    }

    return report;
}
