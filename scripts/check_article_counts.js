const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const pathogens = await prisma.pathogen.findMany({
        include: {
            _count: {
                select: { articles: true }
            }
        }
    });

    console.log('Pathogen Article Counts:');
    pathogens.forEach(p => {
        console.log(`- ${p.name}: ${p._count.articles} articles`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
