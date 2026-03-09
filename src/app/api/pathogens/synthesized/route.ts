import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const pathogens = await prisma.pathogen.findMany({
            where: {
                synthesizedContext: {
                    not: null
                }
            },
            select: {
                id: true,
                name: true,
                family: true,
                taxonomy: true,
                updatedAt: true,
                _count: {
                    select: {
                        articles: true,
                        clinicalTrials: true,
                        epidemiologyMetrics: true,
                        surveillanceAlerts: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(pathogens);
    } catch (error: any) {
        console.error("Failed to fetch synthesized pathogens:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
