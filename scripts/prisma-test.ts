import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('Connecting to DB...');
  const count = await prisma.pathogen.count();
  console.log(`Pathogen count: ${count}`);
  await prisma.$disconnect();
}
main().catch(console.error);
