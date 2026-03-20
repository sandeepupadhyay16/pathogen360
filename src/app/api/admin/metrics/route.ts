import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const terms = await prisma.medicalTerm.findMany({
            select: {
                id: true,
                name: true,
                category: true,
                updatedAt: true,
                synthesizedContext: true,
                synthesisUpdatedAt: true,
                synthesisArticleCount: true,
                articles: { select: { countryAffiliations: true } },
                clinicalTrials: { select: { locations: true } },
                surveillanceAlerts: { select: { id: true } },
            },
            orderBy: { name: 'asc' }
        });

        const metrics = terms.map(p => {
            // Basic extraction of country names from affiliations
            // Realistic extraction would involve NLP, here we do a simple string match
            const countByCountry = (keyword: string) => p.articles.filter(a => a.countryAffiliations?.toLowerCase().includes(keyword.toLowerCase())).length;

            return {
                id: p.id,
                name: p.name,
                category: p.category,
                totalArticles: p.articles.length,
                totalReports: p.surveillanceAlerts.length,
                lastUpdated: p.updatedAt,
                synthesisArticleCount: p.synthesisArticleCount || 0,
                synthesisUpdatedAt: p.synthesisUpdatedAt || null,
                isSynthesized: !!p.synthesizedContext,
                clinicalTrialsCount: p.clinicalTrials.length,
                countryBreakdown: {
                    USA: countByCountry('usa') || countByCountry('united states'),
                    Germany: countByCountry('germany'),
                    Japan: countByCountry('japan'),
                    UK: countByCountry('uk') || countByCountry('united kingdom'),
                },
                alertCount: p.surveillanceAlerts?.length || 0
            };
        });

        return NextResponse.json({ medicalTerms: metrics });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
