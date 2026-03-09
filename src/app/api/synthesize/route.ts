import { NextResponse } from 'next/server';
import { createOperation } from '@/lib/operations';
import { executeSynthesizeTask } from '@/lib/tasks/synthesize';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { all } = body;
        const operation = await createOperation('SYNTHESIZE', all ? 'All Pathogens' : 'Selected', body);

        executeSynthesizeTask(operation.id, body).catch(err => {
            console.error(`Synthesis Operation ${operation.id} failed:`, err);
        });

        return NextResponse.json({
            message: 'Synthesis started in background',
            operationId: operation.id
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
