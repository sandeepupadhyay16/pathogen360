import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ReportClient from './ReportClient';
import { buildMedicalTermContext } from '@/lib/context';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const term = await prisma.medicalTerm.findUnique({
        where: { id: id },
        include: {
            articles: {
                take: 50,
                orderBy: { publicationDate: 'desc' }
            },
            clinicalTrials: true
        }
    }) as any;

    if (term) {
        // Manually fetch logical questions using raw SQL to bypass stale client types
        const logicalQuestions = await prisma.$queryRaw<any[]>`
            SELECT * FROM "LogicalQuestion" 
            WHERE "medicalTermId" = ${id} 
            ORDER BY "createdAt" ASC
        `;
        term.logicalQuestions = logicalQuestions;
    }

    if (!term) {
        notFound();
    }

    // Reuse the context builder to get the exact same sources and refIndices
    // that the LLM was given during synthesis/generation.
    const { sources: dynamicSources } = buildMedicalTermContext(term);
    const sources = term.synthesisSources || dynamicSources;

    return <ReportClient report={term} sources={sources} />;
}
