// DB column seeding script for synthesis fields.
// Run: node scripts/add_synthesis_columns.js
const { execSync } = require('child_process');

const sql = `
ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "synthesizedContext" TEXT;
ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "synthesisUpdatedAt" TIMESTAMP;
ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "synthesisArticleCount" INTEGER;
`;

try {
    execSync(`psql "postgresql://supadhyay@127.0.0.1:5432/pathogen360" -c '${sql.replace(/'/g, "\\'")}' `, { stdio: 'inherit' });
} catch (e) {
    // fallback: try via prisma
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.$connect().then(() => {
        return prisma.$executeRawUnsafe(sql);
    }).then(() => {
        console.log('Columns added via Prisma.');
        return prisma.$disconnect();
    }).catch(err => {
        console.error('Failed to add columns:', err);
        process.exit(1);
    });
}
