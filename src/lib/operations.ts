import { prisma } from './prisma';

export type OperationType = 'INGEST' | 'SYNTHESIZE' | 'SYNC_TRIALS' | 'SYNC_HEALTH' | 'PURGE' | 'BACKFILL';
export type OperationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export async function createOperation(type: OperationType, target?: string, metadata?: any) {
    return await prisma.operation.create({
        data: {
            type,
            status: 'PENDING',
            target,
            metadata: metadata || null,
            startedAt: new Date(),
        },
    });
}

export async function updateOperation(id: string, data: {
    status?: OperationStatus;
    progress?: number;
    message?: string;
    error?: string;
    completedAt?: Date;
    durationMs?: number;
}) {
    return await prisma.operation.update({
        where: { id },
        data,
    });
}

export async function abortOperation(id: string) {
    return await prisma.operation.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            message: 'Operation aborted by user.'
        },
    });
}

export async function addOperationLog(id: string, message: string, level: string = 'INFO', durationMs?: number) {
    return await prisma.operationLog.create({
        data: {
            operationId: id,
            message,
            level,
            durationMs,
        },
    });
}

export async function runInContext(id: string, task: (op: {
    log: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR', durationMs?: number) => Promise<void>;
    progress: (val: number, msg?: string) => Promise<void>;
    step: <T>(msg: string, fn: () => Promise<T>) => Promise<T>;
    checkAbort: () => Promise<void>;
}) => Promise<void>) {
    const start = Date.now();
    await updateOperation(id, { status: 'RUNNING', message: 'Starting operation...' });

    const checkAbort = async () => {
        const op = await prisma.operation.findUnique({
            where: { id },
            select: { status: true }
        });
        if (op?.status === 'CANCELLED') {
            throw new Error('OPERATION_ABORTED');
        }
    };

    const context = {
        checkAbort,
        log: async (msg: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO', durationMs?: number) => {
            console.log(`[OP:${id}] ${msg}`);
            await addOperationLog(id, msg, level, durationMs);
        },
        progress: async (val: number, msg?: string) => {
            await checkAbort();
            await updateOperation(id, { progress: val, message: msg });
        },
        step: async <T>(msg: string, fn: () => Promise<T>): Promise<T> => {
            await checkAbort();
            const stepStart = Date.now();
            try {
                const res = await fn();
                const stepEnd = Date.now();
                await addOperationLog(id, msg, 'INFO', stepEnd - stepStart);
                return res;
            } catch (err: any) {
                const stepEnd = Date.now();
                await addOperationLog(id, `Step Failed: ${msg} - ${err.message}`, 'ERROR', stepEnd - stepStart);
                throw err;
            }
        }
    };

    try {
        await task(context);
        const end = Date.now();

        // Final check status before marking complete
        const finalOp = await prisma.operation.findUnique({ where: { id }, select: { status: true } });
        if (finalOp?.status === 'CANCELLED') return;

        await updateOperation(id, {
            status: 'COMPLETED',
            progress: 100,
            completedAt: new Date(end),
            durationMs: end - start,
            message: 'Operation completed successfully.'
        });
    } catch (error: any) {
        if (error.message === 'OPERATION_ABORTED') {
            await addOperationLog(id, 'Task execution halted due to user abort.', 'WARN');
            return;
        }

        console.error(`[OP:${id}] Global Failure:`, error);
        const end = Date.now();
        await updateOperation(id, {
            status: 'FAILED',
            error: error.message,
            completedAt: new Date(end),
            durationMs: end - start,
            message: `Operation failed: ${error.message}`
        });
    }
}
