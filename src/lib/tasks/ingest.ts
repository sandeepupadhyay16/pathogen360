import { prisma } from '@/lib/prisma';
import { searchPubMed, fetchPubMedDetails } from '@/lib/pubmed';
import { generateLLMResponse } from '@/lib/llm';
import { runInContext } from '@/lib/operations';
import { syncTrialsForPathogen } from './trials';
import { syncHealthForPathogen } from './health';
import fs from 'fs';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/config/pathogen-registry.json');

function appendToRegistry(name: string) {
    try {
        const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
        const registry = JSON.parse(raw);
        const existing = new Set(registry.pathogens.map((p: string) => p.toLowerCase()));
        if (!existing.has(name.toLowerCase())) {
            registry.pathogens.push(name);
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
        }
    } catch { }
}

export async function executeIngestTask(opId: string, params: any) {
    const { pathogenName, maxResults, scope = 'pathogen', timeframe = '10y', pubmedDetails = 'abstract', customYearStart, customYearEnd } = params;
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

    await runInContext(opId, async (ctx) => {
        const doSinglePathogenIngest = async (pName: string, pStart: number, pEnd: number) => {
            const range = pEnd - pStart;
            const update = async (pct: number, msg: string) => {
                await ctx.progress(pStart + Math.floor((pct / 100) * range), msg);
            };

            await update(5, `Initializing ingestion for ${pName}...`);

            // Family identification
            const family = await ctx.step(`Identify family for ${pName}`, async () => {
                const familyPrompt = `Identify the taxonomic family for the pathogen: "${pName}". Respond with ONLY the family name. If unknown, respond with "Unknown".`;
                const { content: resp } = await generateLLMResponse([
                    { role: 'system', content: 'You are a microbiologist and taxonomist.' },
                    { role: 'user', content: familyPrompt }
                ], 0);
                let f = resp.trim().replace(/\.$/, '').replace(/["']/g, '');
                return (f.toLowerCase() === 'unknown' || f.length > 50) ? null : f;
            });

            const pathogen = await prisma.pathogen.upsert({
                where: { name: pName },
                update: { family },
                create: { name: pName, family }
            });

            appendToRegistry(pName);

            // 1. PubMed
            await update(10, `Searching PubMed for ${pName}...`);
            const pubmedIds = await ctx.step(`Search PubMed for ${pName}`, () => searchPubMed(pName, limit, startYear, endYear));

            if (pubmedIds.length > 0) {
                const articles = await ctx.step(`Fetch details for ${pubmedIds.length} articles`, () => fetchPubMedDetails(pubmedIds, fetchFullText));
                await update(40, `Saving ${articles.length} articles...`);
                let saved = 0;
                for (let i = 0; i < articles.length; i++) {
                    const art = articles[i];
                    try {
                        await prisma.article.upsert({
                            where: { pubmedId_pathogenId: { pubmedId: art.pubmedId, pathogenId: pathogen.id } },
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
                                pathogenId: pathogen.id
                            }
                        });
                        saved++;
                    } catch { }
                    if (i % 20 === 0 || i === articles.length - 1) {
                        await update(40 + Math.floor((i / articles.length) * 30), `Saving PubMed: ${i + 1}/${articles.length}`);
                    }
                }
                await ctx.log(`✓ ${pName}: PubMed ingestion complete (${saved} articles).`);
            } else {
                await ctx.log(`! ${pName}: No PubMed articles found.`);
            }

            // 2. Clinical Trials
            await update(70, `Syncing Clinical Trials for ${pName}...`);
            await syncTrialsForPathogen(pathogen, ctx, limit);

            // 3. Health Metrics (WHO/CDC)
            await update(85, `Syncing Health Metrics for ${pName}...`);
            await syncHealthForPathogen(pathogen, ctx);

            await update(100, `Ingestion complete for ${pName}.`);
        };

        if (scope === 'all') {
            await ctx.log("Starting Global Ingestion...");
            const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
            const pathogens = registry.pathogens || [];
            if (pathogens.length === 0) throw new Error("Registry is empty");

            for (let i = 0; i < pathogens.length; i++) {
                const pStart = 5 + Math.floor((i / pathogens.length) * 95);
                const pEnd = 5 + Math.floor(((i + 1) / pathogens.length) * 95);
                await doSinglePathogenIngest(pathogens[i], pStart, pEnd);
            }
        } else if (scope === 'family') {
            await ctx.log(`Analyzing taxonomic group: ${pathogenName}...`);
            const response = await ctx.step(`Expand family: ${pathogenName}`, async () => {
                const prompt = `Identify the top 7 most clinically significant pathogens that belong to the taxonomic group: "${pathogenName}". Respond ONLY with comma-separated names.`;
                const { content } = await generateLLMResponse([{ role: 'user', content: prompt }], 0);
                return content;
            });
            const pathogens = response.split(/[,;\n]/).map(s => s.trim()).filter(s => s.length > 3);
            if (pathogens.length === 0) throw new Error(`No pathogens found for family ${pathogenName}`);

            for (let i = 0; i < pathogens.length; i++) {
                const pStart = 10 + Math.floor((i / pathogens.length) * 90);
                const pEnd = 10 + Math.floor(((i + 1) / pathogens.length) * 90);
                await doSinglePathogenIngest(pathogens[i], pStart, pEnd);
            }
        } else {
            if (!pathogenName) throw new Error("Pathogen name required");
            await doSinglePathogenIngest(pathogenName, 0, 100);
        }
    });
}
