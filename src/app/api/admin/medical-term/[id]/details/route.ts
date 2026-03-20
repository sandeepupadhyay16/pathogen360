import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: 'Term ID is required.' }, { status: 400 });
        }

        const term = await prisma.medicalTerm.findUnique({
            where: { id },
            include: {
                articles: {
                    orderBy: { publicationDate: 'desc' },
                },
                clinicalTrials: {
                    orderBy: { startDate: 'desc' },
                },
                metrics: {
                    orderBy: { year: 'desc' },
                },
                surveillanceAlerts: {
                    orderBy: { publishedAt: 'desc' },
                },
                knowledgeChunks: true
            },
        }) as any;

        if (!term) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        // Manually fetch logical questions using raw SQL to ensure 'answer' is included
        const logicalQuestions = await prisma.$queryRaw<any[]>`
            SELECT * FROM "LogicalQuestion" 
            WHERE "medicalTermId" = ${id} 
            ORDER BY "createdAt" ASC
        `;
        
        term.logicalQuestions = logicalQuestions;

        if (!term) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        const { metrics, ...rest } = term;
        const responseData = {
            ...rest,
            epidemiologyMetrics: metrics,
        };

        return NextResponse.json(responseData);
    } catch (error: any) {
        console.error('Fetch term details error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch medical term details.' }, { status: 500 });
    }
}
