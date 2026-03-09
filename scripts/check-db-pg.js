const { Client } = require('pg');

async function checkData() {
    const client = new Client({
        connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/pathogen360"
    });

    try {
        await client.connect();
        console.log("Connected to DB.");

        const marketCount = await client.query('SELECT COUNT(*) FROM "MarketReport"');
        console.log("MarketReport Count:", marketCount.rows[0].count);

        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Message'
        `);
        console.log("Message Table Columns:", columns.rows.map(r => r.column_name));

        const pathogens = await client.query('SELECT name FROM "Pathogen" LIMIT 5');
        console.log("Some Pathogens:", pathogens.rows.map(r => r.name));

        const reports = await client.query(`
            SELECT p.name, r."marketPotential", r."investmentGaps" 
            FROM "MarketReport" r 
            JOIN "Pathogen" p ON r."pathogenId" = p.id 
            LIMIT 10
        `);
        console.log("Market Reports Details:", reports.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

checkData();
