import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
    const existing = globalForPrisma.prisma;
    // If the model is missing (stale client), force a new instance
    if (existing && (existing as any).logicalQuestion) return existing;
    
    const fresh = new PrismaClient({
        log: ['query', 'error', 'warn'],
    });
    
    if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = fresh;
    }
    return fresh;
})();
