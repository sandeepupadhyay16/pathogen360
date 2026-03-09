import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allPathogens = await prisma.pathogen.findMany();
  const synthesizedPathogens = allPathogens.filter(p => p.synthesizedContext);
  
  console.log(`Total pathogens: ${allPathogens.length}`);
  console.log(`Synthesized pathogens: ${synthesizedPathogens.length}`);
  
  if (synthesizedPathogens.length > 0) {
    console.log('Sample synthesized pathogen:', synthesizedPathogens[0].name);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
