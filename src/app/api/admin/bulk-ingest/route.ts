import { prisma } from '@/lib/prisma';
import { searchPubMed, fetchPubMedDetails } from '@/lib/pubmed';
import { generateLLMResponse } from '@/lib/llm';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/config/medical-term-registry.json');
const RATE_LIMIT_DELAY = 1500; // ms between PubMed requests to avoid 429s

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function readRegistry(): { medicalTerms: string[]; defaultScanDepth: number } {
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
        const medicalTerms = registry.medicalTerms;
        const scanDepth = registry.defaultScanDepth || 50;
        jobState.total = medicalTerms.length;

        if (medicalTerms.length === 0) {
            addLog('Registry is empty. Add medical terms first.');
            jobState.running = false;
            jobState.finishedAt = new Date().toISOString();
            return;
        }

        addLog(`Starting bulk ingestion for ${medicalTerms.length} medical terms (scan depth: ${scanDepth})...`);
        const failedNames: string[] = [];

        for (const medicalTermName of medicalTerms) {
            const pct = Math.floor((jobState.completed / medicalTerms.length) * 100);
            jobState.progress = pct;

            // Check if already ingested (resume behavior)
            if (!force) {
                const existing = await prisma.medicalTerm.findFirst({
                    where: { name: medicalTermName },
                    include: { _count: { select: { articles: true } } }
                });
                if (existing && existing._count.articles > 0) {
                    jobState.skipped++;
                    jobState.completed++;
                    addLog(`⏭ Skipping ${medicalTermName} — already has ${existing._count.articles} articles`);
                    continue;
                }
            }

            addLog(`[${jobState.completed + 1}/${medicalTerms.length}] Ingesting: ${medicalTermName}...`);

            try {
                // (Family fetching removed for MedicalTerm format)

                // Upsert medical term
                const term = await prisma.medicalTerm.upsert({
                    where: { name: medicalTermName },
                    update: {},
                    create: { name: medicalTermName }
                });
                const medicalTermId = term.id;

                // Search PubMed
                const pubmedIds = await searchPubMed(medicalTermName, scanDepth);

                if (pubmedIds.length === 0) {
                    addLog(`  ⚠ ${medicalTermName}: No PubMed articles found`);
                    jobState.completed++;
                    continue;
                }

                // Fetch details (includes PMC full-text)
                const articles = await fetchPubMedDetails(pubmedIds);
                let savedCount = 0;

                for (const article of articles) {
                    try {
                        // Use compound unique (pubmedId + medicalTermId) for upsert
                        await prisma.article.upsert({
                            where: {
                                pubmedId_medicalTermId: {
                                    pubmedId: article.pubmedId,
                                    medicalTermId: medicalTermId
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
                                medicalTermId: medicalTermId
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
                addLog(`  ✓ ${medicalTermName}: ${savedCount} articles saved (${ftCount} full-text)`);

                // Rate limit between medical terms
                await sleep(RATE_LIMIT_DELAY);
            } catch (err: any) {
                jobState.failed++;
                failedNames.push(medicalTermName);
                console.error(`Bulk ingest failed for ${medicalTermName}:`, err);
                addLog(`  ✗ ${medicalTermName}: FAILED — ${err.message || 'Unknown error'}`);
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
        total: readRegistry().medicalTerms.length,
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
