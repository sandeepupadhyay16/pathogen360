const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/pathogen360"
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB");

        await client.query('ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "synthesizedContext" TEXT');
        await client.query('ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "synthesisUpdatedAt" TIMESTAMP(3)');
        await client.query('ALTER TABLE "Pathogen" ADD COLUMN IF NOT EXISTS "synthesisArticleCount" INTEGER');

        console.log("Migration complete: Added synthesis columns to Pathogen table.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

main();
