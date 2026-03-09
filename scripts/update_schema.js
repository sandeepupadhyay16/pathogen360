const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Attempting to add family column to Pathogen table...');
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "family" TEXT;');
        console.log('Successfully added family column.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
