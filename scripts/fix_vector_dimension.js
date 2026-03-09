const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Updating vector dimensions for KnowledgeChunk and SemanticCache...');
    try {
        // Drop and recreate to ensure dimension change works (safer than ALTER TYPE)
        // Or just try ALTER TYPE first
        await prisma.$executeRawUnsafe('ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" TYPE vector(768);');
        console.log('Successfully updated KnowledgeChunk embedding dimension to 768.');

        await prisma.$executeRawUnsafe('ALTER TABLE "SemanticCache" ALTER COLUMN "embedding" TYPE vector(768);');
        console.log('Successfully updated SemanticCache embedding dimension to 768.');
    } catch (err) {
        console.error('Error updating dimensions:', err);
        console.log('Attempting drop and recreate approach...');
        try {
            await prisma.$executeRawUnsafe('ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding";');
            await prisma.$executeRawUnsafe('ALTER TABLE "KnowledgeChunk" ADD COLUMN "embedding" vector(768);');

            await prisma.$executeRawUnsafe('ALTER TABLE "SemanticCache" DROP COLUMN "embedding";');
            await prisma.$executeRawUnsafe('ALTER TABLE "SemanticCache" ADD COLUMN "embedding" vector(768);');
            console.log('Successfully recreated embedding columns with 768 dimensions.');
        } catch (innerErr) {
            console.error('Recreation failed:', innerErr);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
