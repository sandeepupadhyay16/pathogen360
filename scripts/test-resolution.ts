import { pathogenResolver } from '../src/lib/pathogen-resolver';
import { prisma } from '../src/lib/prisma';

async function testResolution() {
  const testQueries = [
    'SARS-CoV-2',
    'covid-19',
    'coronavirus',
    'flu',
    'influenza a',
    'tb',
    'tuberculosis',
    'the novel coronavirus',
    'wester nile', // typo tolerant
    'shigella',
    'ebola'
  ];

  console.log('--- Pathogen Resolution Test ---');
  
  for (const query of testQueries) {
    try {
      const result = await pathogenResolver.resolve(query);
      console.log(`Query: "${query}"`);
      if (result.found) {
        console.log(`  ✅ Resolved to: "${result.canonicalName}"`);
        console.log(`  Confidence: ${result.confidence.toFixed(2)}`);
        console.log(`  Method: ${result.isFuzzyMatch ? 'Fuzzy/Semantic' : 'Exact/DB'}`);
      } else {
        console.log(`  ❌ Resolution failed`);
      }
      console.log('---------------------------');
    } catch (err) {
      console.error(`Error testing query "${query}":`, err);
    }
  }

  // Check database for an embedding
  try {
    const embeddingCount = await prisma.pathogenNameEmbedding.count();
    console.log(`Current embeddings in DB: ${embeddingCount}`);
  } catch (err) {
    console.warn('Could not check DB embeddings:', err);
  }

  process.exit(0);
}

testResolution().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
