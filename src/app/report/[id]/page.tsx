import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ReportClient from './ReportClient';
import { buildPathogenContext } from '@/lib/context';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const report = await prisma.marketReport.findUnique({
        where: { id: id },
        include: {
            pathogen: {
                include: {
                    articles: {
                        take: 50,
                        orderBy: { publicationDate: 'desc' }
                    },
                    clinicalTrials: true
                }
            }
        }
    });

    if (!report) {
        notFound();
    }

    // Reuse the context builder to get the exact same sources and refIndices
    // that the LLM was given during synthesis/generation.
    const { sources } = buildPathogenContext(report.pathogen);

    return <ReportClient report={report} sources={sources} />;
}
