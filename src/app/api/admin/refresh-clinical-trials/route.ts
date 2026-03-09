import { NextResponse } from 'next/server';
import { createOperation } from '@/lib/operations';
import { executeTrialsTask } from '@/lib/tasks/trials';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const operation = await createOperation('SYNC_TRIALS', body.pathogenId ? 'Single Pathogen' : 'Global Sync', body);

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
