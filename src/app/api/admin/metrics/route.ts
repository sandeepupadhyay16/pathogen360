import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const pathogens = await prisma.pathogen.findMany({
            select: {
                id: true,
                name: true,
                family: true,
                updatedAt: true,
                synthesizedContext: true,
                synthesisUpdatedAt: true,
                synthesisArticleCount: true,
                articles: { select: { countryAffiliations: true } },
                reports: { select: { id: true } },
                clinicalTrials: { select: { isVaccine: true, locations: true } },
                epidemiologyMetrics: { select: { id: true } },
                surveillanceAlerts: { select: { id: true } },
            },
            orderBy: { name: 'asc' }
        });

        const metrics = pathogens.map(p => {
            // Basic extraction of country names from affiliations
            // Realistic extraction would involve NLP, here we do a simple string match
            const countByCountry = (keyword: string) => p.articles.filter(a => a.countryAffiliations?.toLowerCase().includes(keyword.toLowerCase())).length;

            const vaccineTrials = p.clinicalTrials.filter((t: any) => t.isVaccine);
            const countTrialsByCountry = (keywords: string[]) => vaccineTrials.filter((t: any) =>
                keywords.some(k => t.locations?.toLowerCase().includes(k.toLowerCase()))
            ).length;

            return {
                id: p.id,
                name: p.name,
                family: p.family,
                totalArticles: p.articles.length,
                totalReports: p.reports.length,
                lastUpdated: p.updatedAt,
                synthesisArticleCount: p.synthesisArticleCount || 0,
                synthesisUpdatedAt: p.synthesisUpdatedAt || null,
                isSynthesized: !!p.synthesizedContext,
                vaccineTrialsCount: vaccineTrials.length,
                totalTrialsCount: p.clinicalTrials.length,
                countryBreakdown: {
                    USA: countByCountry('usa') || countByCountry('united states'),
                    Germany: countByCountry('germany'),
                    Japan: countByCountry('japan'),
                    UK: countByCountry('uk') || countByCountry('united kingdom'),
                },
                vaccineTrialsBreakdown: {
                    USA: countTrialsByCountry(['usa', 'united states', 'u.s.']),
                    Germany: countTrialsByCountry(['germany']),
                    Japan: countTrialsByCountry(['japan']),
                    UK: countTrialsByCountry(['uk', 'united kingdom', 'u.k.']),
                },
                epiCount: p.epidemiologyMetrics?.length || 0,
                alertCount: p.surveillanceAlerts?.length || 0
            };
        });

        return NextResponse.json({ pathogens: metrics });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
