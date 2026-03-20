import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json([]);
        }

        // Search for medical terms and categories
        const terms = await prisma.medicalTerm.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { category: { contains: query, mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                name: true,
                category: true
            },
            take: 10
        });

        const formattedResults = terms.map(t => ({
            id: t.id,
            name: t.name,
            label: t.name,
            type: t.category && t.category.toLowerCase().includes(query.toLowerCase()) ? 'Category' : 'Term'
        }));

        return NextResponse.json(formattedResults);
    } catch (error: any) {
        console.error('[API:SEARCH] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
