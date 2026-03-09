import { prisma } from '@/lib/prisma';
import { searchPubMed, fetchPubMedDetails } from '@/lib/pubmed';
import { generateLLMResponse } from '@/lib/llm';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/config/pathogen-registry.json');
const RATE_LIMIT_DELAY = 1500; // ms between PubMed requests to avoid 429s

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function readRegistry(): { pathogens: string[]; defaultScanDepth: number } {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    return JSON.parse(raw);
}

// ── In-memory job state (persists across requests within the same server process) ──
interface JobState {
    running: boolean;
    progress: number;
    log: string[];
    completed: number;
    skipped: number;
    failed: number;
    totalArticles: number;
    total: number;
    startedAt: string | null;
    finishedAt: string | null;
}

const jobState: JobState = {
    running: false,
    progress: 0,
    log: [],
    completed: 0,
    skipped: 0,
    failed: 0,
    totalArticles: 0,
    total: 0,
    startedAt: null,
    finishedAt: null,
};

function addLog(msg: string) {
    jobState.log.unshift(msg);
    if (jobState.log.length > 300) jobState.log.length = 300;
}

/** Background ingestion — runs detached from the HTTP response */
async function runBulkIngest(force: boolean) {
    jobState.running = true;
    jobState.progress = 0;
    jobState.log = [];
    jobState.completed = 0;
    jobState.skipped = 0;
    jobState.failed = 0;
    jobState.totalArticles = 0;
    jobState.startedAt = new Date().toISOString();
    jobState.finishedAt = null;

    try {
        const registry = readRegistry();
        const pathogens = registry.pathogens;
        const scanDepth = registry.defaultScanDepth || 50;
        jobState.total = pathogens.length;

        if (pathogens.length === 0) {
            addLog('Registry is empty. Add pathogens first.');
            jobState.running = false;
            jobState.finishedAt = new Date().toISOString();
            return;
        }

        addLog(`Starting bulk ingestion for ${pathogens.length} pathogens (scan depth: ${scanDepth})...`);
        const failedNames: string[] = [];

        for (const pathogenName of pathogens) {
            const pct = Math.floor((jobState.completed / pathogens.length) * 100);
            jobState.progress = pct;

            // Check if already ingested (resume behavior)
            if (!force) {
                const existing = await prisma.pathogen.findFirst({
                    where: { name: pathogenName },
                    include: { _count: { select: { articles: true } } }
                });
                if (existing && existing._count.articles > 0) {
                    jobState.skipped++;
                    jobState.completed++;
                    addLog(`⏭ Skipping ${pathogenName} — already has ${existing._count.articles} articles`);
                    continue;
                }
            }

            addLog(`[${jobState.completed + 1}/${pathogens.length}] Ingesting: ${pathogenName}...`);

            try {
                // Identify family via LLM
                const familyPrompt = `Identify the taxonomic family for the pathogen: "${pathogenName}".
This could be a virus, bacterium, fungus, or parasite.
Examples: Filoviridae, Flaviviridae, Coronaviridae, Enterobacteriaceae, Candida (genus), Plasmodiidae.
Respond with ONLY the family name — no explanation, no formatting, no punctuation. If truly unknown, respond with "Unknown".`;

                let { content: familyResponse } = await generateLLMResponse([
                    { role: 'system', content: 'You are a microbiologist and taxonomist. Provide only the requested taxonomic family name with no additional text.' },
                    { role: 'user', content: familyPrompt }
                ], 0);
                let family: string | null = familyResponse.trim().replace(/\.$/, '').replace(/["']/g, '');
                if (family.toLowerCase() === 'unknown' || family.length > 50) family = null;

                // Upsert pathogen
                const pathogen = await prisma.pathogen.upsert({
                    where: { name: pathogenName },
                    update: { family: family || undefined },
                    create: { name: pathogenName, family }
                });

                // Search PubMed
                const pubmedIds = await searchPubMed(pathogenName, scanDepth);

                if (pubmedIds.length === 0) {
                    addLog(`  ⚠ ${pathogenName}: No PubMed articles found`);
                    jobState.completed++;
                    continue;
                }

                // Fetch details (includes PMC full-text)
                const articles = await fetchPubMedDetails(pubmedIds);
                let savedCount = 0;

                for (const article of articles) {
                    try {
                        // Use compound unique (pubmedId + pathogenId) for upsert
                        await prisma.article.upsert({
                            where: {
                                pubmedId_pathogenId: {
                                    pubmedId: article.pubmedId,
                                    pathogenId: pathogen.id
                                }
                            },
                            update: {
                                title: article.title,
                                abstractText: article.abstractText,
                                authors: article.authors,
                                pmcId: article.pmcId,
                                hasFullText: article.hasFullText,
                                publicationDate: article.publicationDate ? new Date(article.publicationDate) : null,
                                countryAffiliations: article.countryAffiliations,
                            },
                            create: {
                                pubmedId: article.pubmedId,
                                pmcId: article.pmcId,
                                hasFullText: article.hasFullText,
                                title: article.title,
                                abstractText: article.abstractText,
                                authors: article.authors,
                                publicationDate: article.publicationDate ? new Date(article.publicationDate) : null,
                                countryAffiliations: article.countryAffiliations,
                                pathogenId: pathogen.id
                            }
                        });
                        savedCount++;
                    } catch (e: any) {
                        // Skip individual article errors
                        console.error(`  Article save error (${article.pubmedId}):`, e.message);
                    }
                }

                jobState.totalArticles += savedCount;
                const ftCount = articles.filter(a => a.hasFullText).length;
                addLog(`  ✓ ${pathogenName} (${family || '?'}): ${savedCount} articles saved (${ftCount} full-text)`);

                // Rate limit between pathogens
                await sleep(RATE_LIMIT_DELAY);
            } catch (err: any) {
                jobState.failed++;
                failedNames.push(pathogenName);
                console.error(`Bulk ingest failed for ${pathogenName}:`, err);
                addLog(`  ✗ ${pathogenName}: FAILED — ${err.message || 'Unknown error'}`);
                await sleep(RATE_LIMIT_DELAY);
            }

            jobState.completed++;
        }

        const successCount = jobState.completed - jobState.failed - jobState.skipped;
        let summary = `✅ Bulk ingestion complete. ${successCount} ingested, ${jobState.skipped} skipped, ${jobState.failed} failed. ${jobState.totalArticles} total articles saved.`;
        if (failedNames.length > 0) {
            summary += ` Failed: ${failedNames.join(', ')}. Click "Rebuild" to retry.`;
        }
        addLog(summary);
        jobState.progress = 100;
    } catch (err: any) {
        console.error('Bulk ingest error:', err);
        addLog(`Fatal error: ${err.message}`);
    } finally {
        jobState.running = false;
        jobState.finishedAt = new Date().toISOString();
    }
}

/**
 * POST /api/admin/bulk-ingest
 * Kicks off the background ingestion job. Returns immediately.
 */
export async function POST(request: Request) {
    if (jobState.running) {
        return NextResponse.json({ error: 'Ingestion already in progress.', status: jobState }, { status: 409 });
    }

    const { force } = await request.json().catch(() => ({}));

    // Fire-and-forget: start the job but don't await it
    runBulkIngest(!!force);

    return NextResponse.json({
        message: 'Bulk ingestion started.',
        total: readRegistry().pathogens.length,
    });
}

/**
 * GET /api/admin/bulk-ingest
 * Returns the current job status for polling.
 */
export async function GET() {
    return NextResponse.json({
        running: jobState.running,
        progress: jobState.progress,
        log: jobState.log.slice(0, 50), // Latest 50 entries
        completed: jobState.completed,
        skipped: jobState.skipped,
        failed: jobState.failed,
        totalArticles: jobState.totalArticles,
        total: jobState.total,
        startedAt: jobState.startedAt,
        finishedAt: jobState.finishedAt,
    });
}
