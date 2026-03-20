import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOperation } from '@/lib/operations';
import { executeIngestTask } from '@/lib/tasks/ingest';
import { executeSynthesizeTask } from '@/lib/tasks/synthesize';
import { executeTrialsTask } from '@/lib/tasks/trials';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'Original Operation ID required' }, { status: 400 });

        // Get the failed operation and its metadata
        const originalOp = await prisma.operation.findUnique({
            where: { id }
        });

        if (!originalOp) {
            return NextResponse.json({ error: 'Original operation not found' }, { status: 404 });
        }

        const { type, target, metadata } = originalOp;

        if (!metadata || Object.keys(metadata).length === 0) {
            return NextResponse.json({
                error: 'Cannot restart: Original parameters (metadata) are missing. This operation was likely created before the restart feature was fully implemented.'
            }, { status: 400 });
        }

        const params = metadata;
        console.log(`[RESTART] Triggering restart for ${type} (${id}) with params:`, JSON.stringify(params));

        // Create a new operation for the restart
        const newOp = await createOperation(type as any, target || undefined, params);

        // Map type to the correct task executor
        switch (type) {
            case 'INGEST':
                executeIngestTask(newOp.id, params).catch(e => console.error('Restart failure:', e));
                break;
            case 'SYNTHESIZE':
                executeSynthesizeTask(newOp.id, params).catch(e => console.error('Restart failure:', e));
                break;
            case 'SYNC_TRIALS':
                executeTrialsTask(newOp.id, params).catch(e => console.error('Restart failure:', e));
                break;
            default:
                await prisma.operation.update({
                    where: { id: newOp.id },
                    data: { status: 'FAILED', error: `Restart not supported for operation type: ${type}` }
                });
                break;
        }

        return NextResponse.json({
            message: 'Restart triggered successfully',
            operationId: newOp.id
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
