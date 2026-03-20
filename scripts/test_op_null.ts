import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const ops = await prisma.operation.findMany({ 
        orderBy: { startedAt: 'desc' }, take: 1, 
        include: { logs: { orderBy: { timestamp: 'desc' }, take: 50 } } 
    });
    console.log(JSON.stringify(ops, null, 2));
}
run();
