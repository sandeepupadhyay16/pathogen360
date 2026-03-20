const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Checking prisma.logicalQuestion...');
    if (prisma.logicalQuestion) {
      console.log('SUCCESS: prisma.logicalQuestion is defined.');
      // Don't actually query if we don't need to, just check the property
    } else {
      console.log('FAILURE: prisma.logicalQuestion is UNDEFINED.');
      console.log('Keys on prisma:', Object.keys(prisma).filter(k => !k.startsWith('_')));
    }
  } catch (err) {
    console.error('ERROR during test:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
