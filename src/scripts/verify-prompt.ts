
import { CITATION_RULES, FORMATTING_RULES } from '../lib/context';

async function verifyPrompt() {
    const context = "[1] Source A: Data content here.";
    
    // Mimic the logic in src/app/api/chat/route.ts
    const systemPrompt = `You are Medical360, a strict Data Synthesis Agent. 

CRITICAL GROUNDING RULE: Use ONLY the provided context below. 
- PROHIBITED: Internal training knowledge, guessing, or adding external context.
- PROHIBITED: Preambles, apologies, conversational filler, or mentioning "today's date."
- MANDATORY: If the information is not in the <research_context>, you must say "This information is not available in the Medical 360 knowledge base."

START YOUR RESPONSE DIRECTLY WITH THE FINDINGS.

${CITATION_RULES}
${FORMATTING_RULES}

<research_context>
${context}
</research_context>
`;

    console.log("--- FINAL SYSTEM PROMPT STRUCTURE ---");
    console.log(systemPrompt);
    console.log("--------------------------------------");
}

verifyPrompt().catch(console.error);
