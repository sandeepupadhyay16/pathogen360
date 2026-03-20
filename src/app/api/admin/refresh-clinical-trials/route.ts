import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOperation } from '@/lib/operations';
import { executeTrialsTask } from '@/lib/tasks/trials';

export async function GET() {
    try {
        const [totalTrials, activeTrials, lastOp] = await Promise.all([
            prisma.clinicalTrial.count(),
            prisma.clinicalTrial.count({ where: { status: 'RECRUITING' } }),
            prisma.operation.findFirst({
                where: { type: 'SYNC_TRIALS', status: 'COMPLETED' },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return NextResponse.json({
            totalTrials,
            activeTrials,
            lastRefreshed: lastOp?.createdAt || null
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const operation = await createOperation('SYNC_TRIALS', body.medicalTermId ? 'Single Medical Term' : 'Global Sync', body);

        executeTrialsTask(operation.id, body).catch(err => {
            console.error(`Trials Operation ${operation.id} failed:`, err);
        });

        return NextResponse.json({
            message: 'Clinical trials refresh started in background',
            operationId: operation.id
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
