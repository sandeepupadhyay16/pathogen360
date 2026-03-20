import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
    });

    try {
        console.log('--- Testing Database Connection ---');
        console.log('Environment DATABASE_URL:', process.env.DATABASE_URL);
        
        // Basic query to check connectivity
        const termCount = await prisma.medicalTerm.count();
        console.log(`Successfully connected. MedicalTerm count: ${termCount}`);

        // Try to fetch a few records
        const terms = await prisma.medicalTerm.findMany({
            take: 5,
            select: { id: true, name: true }
        });
        console.log('Sample terms fetched:', terms);

        console.log('--- Connection Test Passed ---');
    } catch (error) {
        console.error('--- Connection Test Failed ---');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
