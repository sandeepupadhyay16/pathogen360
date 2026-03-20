import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Checking prisma.logicalQuestion...');
    if (prisma.logicalQuestion) {
      console.log('SUCCESS: prisma.logicalQuestion is defined.');
      const count = await (prisma as any).logicalQuestion.count();
      console.log('Current count:', count);
    } else {
      console.log('FAILURE: prisma.logicalQuestion is UNDEFINED.');
    }
  } catch (err: any) {
    console.error('ERROR during test:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
