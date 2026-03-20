const { prisma } = require('./src/lib/prisma');

async function testIngest() {
  console.log('--- Ingest Test Starting ---');
  try {
    console.log('Testing prisma connectivity...');
    const term = await prisma.medicalTerm.findFirst();
    if (!term) {
        console.log('No terms found, but prisma.medicalTerm is reachable.');
    } else {
        console.log('Found term:', term.name);
    }

    console.log('Checking for logicalQuestion model...');
    const model = (prisma).logicalQuestion;
    if (model) {
        console.log('SUCCESS: logicalQuestion model found.');
        const count = await model.count();
        console.log('Logical questions count:', count);
    } else {
        console.log('FAILURE: logicalQuestion model is UNDEFINED on prisma client object.');
        console.log('Available keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
    }
  } catch (err) {
    console.error('ERROR during test:', err);
  } finally {
    await prisma.$disconnect();
  }
  console.log('--- Ingest Test Finished ---');
}

testIngest();
