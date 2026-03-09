import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');

        if (!q || q.length < 2) {
            return NextResponse.json({ suggestions: [] });
        }

        const query = q.toLowerCase();

        // Search for pathogens by name, family, or taxonomy
        const pathogens = await prisma.pathogen.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { family: { contains: query, mode: 'insensitive' } },
                    { taxonomy: { contains: query, mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                name: true,
                family: true,
                taxonomy: true
            },
            take: 10
        });

        // Format suggestions
        const suggestions = pathogens.map(p => {
            let label = p.name;
            let type = 'Pathogen';
            
            // If the query matches the family but not the name, highlight the family
            if (p.family?.toLowerCase().includes(query) && !p.name.toLowerCase().includes(query)) {
                label = `${p.family} (Family)`;
                type = 'Family';
            }

            return {
                id: p.id,
                label,
                name: p.name,
                family: p.family,
                type
            };
        });

        // Deduplicate suggestions (e.g., multiple pathogens in the same family)
        const uniqueSuggestions = Array.from(new Map(suggestions.map(s => [s.label, s])).values());

        return NextResponse.json({ suggestions: uniqueSuggestions });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
    }
}
