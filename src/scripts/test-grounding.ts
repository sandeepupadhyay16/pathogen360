
import { generateLLMResponse } from '../lib/llm';
import { CITATION_RULES, FORMATTING_RULES } from '../lib/context';

async function testGrounding() {
    console.log("Starting Robust Grounding Tests...\n");

    const mockContext = `
<research_context>
[1] Article: "Pathophysiology of COVID-19", PMID: 12345
Content: SARS-CoV-2 enters cells via the ACE2 receptor. It primarily affects the respiratory system but can cause systemic inflammation.

[2] Article: "Long COVID Mechanisms", PMID: 67890
Content: Long COVID is associated with persistent immune dysregulation and endothelial dysfunction. There is no evidence in this study regarding vaccine-induced long symptoms.
</research_context>
`;

    const systemPrompt = `You are Medical360, a strict Data Synthesis Agent. 

CRITICAL GROUNDING RULE: Use ONLY the provided context below. 
- PROHIBITED: Internal training knowledge, guessing, or adding external context.
- PROHIBITED: Preambles, apologies, conversational filler, or mentioning "today's date."
- MANDATORY: If the information is not in the <research_context>, you must say "This information is not available in the Medical 360 knowledge base."

START YOUR RESPONSE DIRECTLY WITH THE FINDINGS.

${CITATION_RULES}
${FORMATTING_RULES}

${mockContext}
`;

    const testCases = [
        {
            name: "Unrecognized Term",
            query: "What is Martian Fever?",
            validate: (res: string) => res.trim() === "This information is not available in the Medical 360 knowledge base."
        },
        {
            name: "Anti-Chatter (No Preamble)",
            query: "How does COVID-19 enter cells?",
            validate: (res: string) => !res.toLowerCase().startsWith("okay") && !res.toLowerCase().startsWith("sure") && !res.toLowerCase().startsWith("here is")
        },
        {
            name: "No Hallucinated Dates",
            query: "What is the status of research as of today?",
            validate: (res: string) => !res.includes("2024") && !res.includes("November") && !res.includes("today")
        },
        {
            name: "Strict Adherence (No Outside Knowledge)",
            query: "Does Ivermectin cure COVID-19 according to the context?",
            validate: (res: string) => res.includes("not available") || !res.toLowerCase().includes("ivermectin")
        }
    ];

    for (const tc of testCases) {
        process.stdout.write(`Testing: ${tc.name}... `);
        try {
            const response = await generateLLMResponse([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: tc.query }
            ], 0.1);

            const content = response.content;
            const passed = tc.validate(content);
            
            if (passed) {
                console.log("✅ PASS");
            } else {
                console.log("❌ FAIL");
                console.log(`   Response: "${content.substring(0, 100)}..."`);
            }
        } catch (err) {
            console.log(`❌ ERROR: ${(err as Error).message}`);
        }
    }
}

testGrounding().catch(console.error);
