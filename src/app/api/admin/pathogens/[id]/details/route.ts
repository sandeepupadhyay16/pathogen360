import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const pathogen = await prisma.pathogen.findUnique({
            where: { id },
            include: {
                articles: {
                    orderBy: { publicationDate: 'desc' }
                },
                clinicalTrials: {
                    orderBy: { startDate: 'desc' }
                },
                epidemiologyMetrics: {
                    orderBy: [{ year: 'desc' }, { location: 'asc' }]
                },
                surveillanceAlerts: {
                    orderBy: { publishedAt: 'desc' }
                }
            }
        });

        if (!pathogen) {
            return NextResponse.json({ error: 'Pathogen not found' }, { status: 404 });
        }

        return NextResponse.json(pathogen);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
