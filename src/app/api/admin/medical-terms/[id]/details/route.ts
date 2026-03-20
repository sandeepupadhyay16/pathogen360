import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Fetch the term with everything except logicalQuestions (which might be stale in the client)
        const term = await prisma.medicalTerm.findUnique({
            where: { id },
            include: {
                articles: { orderBy: { publicationDate: 'desc' } },
                clinicalTrials: { orderBy: { startDate: 'desc' } },
                metrics: { orderBy: { year: 'desc' } },
                surveillanceAlerts: { orderBy: { publishedAt: 'desc' } }
            }
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

        return NextResponse.json(term);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
