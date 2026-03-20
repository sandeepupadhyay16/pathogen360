
import { medicalTermResolver } from '../lib/medical-term-resolver';

async function test() {
    const queries = [
        "Does Covid 19 cause long covid?",
        "Do Covid vaccines cause long covid?",
        "Tell me about research on long covid"
    ];

    console.log("Testing Medical Term Resolution Consistency...");
    console.log("-------------------------------------------");

    for (const q of queries) {
        const res = await medicalTermResolver.resolve(q);
        console.log(`Query: "${q}"`);
        console.log(`  -> Resolved: ${res.canonicalName} (Found: ${res.found}, Confidence: ${res.confidence.toFixed(2)})`);
    }
}

test().catch(console.error);
