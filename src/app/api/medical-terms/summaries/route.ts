import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const terms = await prisma.medicalTerm.findMany({
            where: {
                synthesizedContext: {
                    not: null
                }
            },
            select: {
                id: true,
                name: true,
                category: true,
                updatedAt: true,
                _count: {
                    select: {
                        articles: true,
                        clinicalTrials: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(terms);
    } catch (error: any) {
        console.error("Failed to fetch medical terms:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
