import { pathogenResolver } from '../src/lib/pathogen-resolver';

async function testSingle() {
  console.log('Testing single resolution...');
  const result = await pathogenResolver.resolve('covid-19');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

testSingle().catch(console.error);
