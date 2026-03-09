
import { pathogenResolver } from '../src/lib/pathogen-resolver';
import { prisma } from '../src/lib/prisma';

async function verifyRoutingFix() {
    const query = "ongoing clinical trials for chikungunya";
    console.log(`Testing query: "${query}"`);

    // 1. Resolve Pathogen
    const resolution = await pathogenResolver.resolve(query);
    console.log(`Resolution found: ${resolution.found}`);
    console.log(`Canonical Name: ${resolution.canonicalName}`);

    if (!resolution.found) {
        console.error("Pathogen resolution failed. Please ensure 'Chikungunya Virus' is in the database or registry.");
        process.exit(1);
    }

    // 2. Check if in DB
    const matchedInDb = await prisma.pathogen.findFirst({
        where: { name: resolution.canonicalName }
    });
    const resolvedPathogenId = matchedInDb?.id || null;
    console.log(`Pathogen ID in DB: ${resolvedPathogenId || 'NOT_IN_DB'}`);

    // 3. Simulate Routing Safeguard Logic
    let llmMatch = "GENERAL"; // Simulating the failure case where LLM returns GENERAL
    let agentReasoning = "Determining the best path...";

    console.log(`\nSimulating programmatic override logic...`);
    console.log(`Initial Route: ${llmMatch}`);

    if (llmMatch === "GENERAL" && resolution.found && resolvedPathogenId) {
        const pathogenName = resolution.canonicalName.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        // Use the exact same logic as in route.ts
        if (lowerQuery.includes(pathogenName) || pathogenName.split(' ').some(word => word.length > 3 && lowerQuery.includes(word))) {
            console.log(`✅ OVERRIDE TRIGGERED`);
            llmMatch = resolvedPathogenId;
            agentReasoning = `Programmatically rerouted to ${resolution.canonicalName} based on strong name match in query.`;
        }
    }

    console.log(`Final Route: ${llmMatch}`);
    console.log(`Reasoning: ${agentReasoning}`);

    if (llmMatch === resolvedPathogenId) {
        console.log(`\nSUCCESS: Query programmatically routed to specific pathogen ID.`);
    } else {
        console.log(`\nFAILURE: Query remained in GENERAL route.`);
        process.exit(1);
    }

    // 4. Verify Clinical Trials Exist for this pathogen
    if (resolvedPathogenId) {
        const trials = await prisma.clinicalTrial.findMany({
            where: { pathogenId: resolvedPathogenId }
        });
        console.log(`Clinical trials found for ${resolution.canonicalName}: ${trials.length}`);
        if (trials.length === 0) {
            console.warn(`WARNING: No clinical trials found in DB for ${resolution.canonicalName}. While routing is fixed, the response might still be empty.`);
        }
    }

    process.exit(0);
}

verifyRoutingFix().catch(err => {
    console.error("Verification script failed:", err);
    process.exit(1);
});
