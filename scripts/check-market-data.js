const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    try {
        const count = await prisma.marketReport.count();
        console.log("MarketReport Count:", count);
        
        if (count > 0) {
            const samples = await prisma.marketReport.findMany({
                take: 5,
                include: { pathogen: true }
            });
            console.log("Samples:", JSON.stringify(samples, null, 2));
        }

        const pathogens = await prisma.pathogen.findMany({
            include: { reports: true }
        });
        const withReports = pathogens.filter(p => p.reports.length > 0).map(p => p.name);
        console.log("Pathogens with reports:", withReports);

    } catch (err) {
        console.error("Error checking data:", err);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
