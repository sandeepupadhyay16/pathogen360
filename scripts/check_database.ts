
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const term = await prisma.medicalTerm.findFirst({
    where: { name: 'mRNA Cancer Vaccines' },
    include: {
      logicalQuestions: true
    }
  });
  console.log(JSON.stringify(term, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
