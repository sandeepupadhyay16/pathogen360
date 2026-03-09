const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const pathogens = await prisma.pathogen.findMany();
    console.log(`Total Pathogens: ${pathogens.length}`);
    pathogens.slice(0, 5).forEach(p => {
        console.log(`- ${p.name}: Family = ${p.family}`);
    });

    const zika = pathogens.find(p => p.name.includes('Zika'));
    if (zika) {
        console.log(`Zika entry: ${JSON.stringify(zika, null, 2)}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
