import { medicalTermResolver } from './src/lib/medical-term-resolver';

async function test() {
  console.log('Testing resolution for "Explain Alzheimer\'s latest research like I am a 5 year old":');
  const res = await medicalTermResolver.resolve("Explain Alzheimer's latest research like I am a 5 year old");
  console.log(JSON.stringify(res, null, 2));
  
  console.log('\nTesting resolution for "Parkinsons":');
  const res2 = await medicalTermResolver.resolve("Parkinsons");
  console.log(JSON.stringify(res2, null, 2));
}

test().catch(console.error);
