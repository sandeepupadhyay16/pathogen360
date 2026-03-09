import { NextResponse } from 'next/server';
import { createOperation } from '@/lib/operations';
import { executeHealthTask } from '@/lib/tasks/health';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const operation = await createOperation('SYNC_HEALTH', 'Global Health Sync', body);

        executeHealthTask(operation.id).catch(err => {
            console.error(`Health Sync Operation ${operation.id} failed:`, err);
        });

        return NextResponse.json({
            message: 'Global health sync started in background',
            operationId: operation.id
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
