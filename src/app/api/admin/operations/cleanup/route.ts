import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        // Find all tasks that have been RUNNING or PENDING for more than 4 hours
        // and mark them as STALE/FAILED.
        const staleThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000);

        const result = await prisma.operation.updateMany({
            where: {
                status: { in: ['RUNNING', 'PENDING'] },
                startedAt: { lt: staleThreshold }
            },
            data: {
                status: 'FAILED',
                message: 'Task terminated: marked as stale (no activity detected for >4 hours).',
                completedAt: new Date()
            }
        });

        return NextResponse.json({
            message: `Cleanup complete. ${result.count} stale operations were closed.`,
            count: result.count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
