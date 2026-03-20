import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const reports = await prisma.medicalTerm.findMany({
            where: { synthesizedContext: { not: null } },
            orderBy: { synthesisUpdatedAt: 'desc' }
        });

        return NextResponse.json(reports);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
