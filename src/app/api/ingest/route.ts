import { NextResponse } from 'next/server';
import { createOperation } from '@/lib/operations';
import { executeIngestTask } from '@/lib/tasks/ingest';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { pathogenName, scope = 'pathogen' } = body;

        const target = scope === 'all' ? 'All Registry' : (scope === 'family' ? `Family: ${pathogenName}` : pathogenName);
        const operation = await createOperation('INGEST', target, body);

        // Start background task - fire and forget in Node.js
        // In a production Next.js environment on Vercel, this would need 'after()' or an external queue.
        // Assuming local/long-lived Node process here.
        executeIngestTask(operation.id, body).catch(err => {
            console.error(`Background Operation ${operation.id} failed:`, err);
        });

        return NextResponse.json({
            message: 'Ingestion started in background',
            operationId: operation.id
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
