import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
        const operation = await prisma.operation.findUnique({
            where: { id },
            include: {
                logs: {
                    orderBy: { timestamp: 'desc' },
                    take: 50
                }
            }
        });
        return NextResponse.json(operation);
    }

    const operations = await prisma.operation.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50
    });

    return NextResponse.json(operations);
}
