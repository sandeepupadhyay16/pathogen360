import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
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
            if (!operation) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
            return NextResponse.json(operation);
        }

        const operations = await prisma.operation.findMany({
            orderBy: { startedAt: 'desc' },
            take: 50
        });

        return NextResponse.json(operations);
    } catch (err: any) {
        console.error("Operations API GET Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const all = searchParams.get('all') === 'true';

        if (id) {
            await prisma.operation.delete({ where: { id } });
            return NextResponse.json({ success: true, message: 'Operation deleted' });
        }

        if (all) {
            // Delete all except currently running or pending tasks for safety
            const result = await prisma.operation.deleteMany({
                where: {
                    status: {
                        notIn: ['RUNNING', 'PENDING']
                    }
                }
            });
            return NextResponse.json({ 
                success: true, 
                message: `Cleared ${result.count} operations`,
                count: result.count
            });
        }

        return NextResponse.json({ error: 'Missing id or all parameter' }, { status: 400 });
    } catch (err: any) {
        console.error("Operations API DELETE Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
