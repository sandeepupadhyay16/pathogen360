import { generateText } from './llm';

export interface LogicalInquiry {
    question: string;
    category: string;
    searchKeywords: string;
}

/**
 * Generates up to 25 logical research questions for a given medical term.
 * These questions guide the search strategy and the final synthesis.
 */
export async function generateLogicalQuestions(termName: string): Promise<LogicalInquiry[]> {
    const prompt = `You are a senior biomedical research strategist. 
For the medical term "${termName}", identify up to 25 core logical questions that a researcher or clinician would need to answer to have a comprehensive 360-degree understanding of the topic.

Focus on:
1. Pathophysiology & Biological Mechanism
2. Clinical Trial Results & Efficacy
3. Safety Profile & Common Adverse Events
4. Epidemiology, Prevalence & Patient Demographics
5. Current Standard of Care & Unmet Needs
6. Strategic Pipeline & Future Directions

For each question, provide a SINGLE concise search query (max 6-8 keywords) suitable for searching PubMed or ClinicalTrials.gov.

RESPONSE FORMAT:
Return ONLY a JSON array of objects. Do not include any introduction or markdown formatting outside the JSON.
[
  { "question": "What is the primary mechanism of action?", "category": "Mechanism", "searchKeywords": "mechanism of action molecular targets" },
  ...
]`;

    try {
        const response = await generateText(prompt, 0.3);
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const questions = JSON.parse(cleanJson);
        
        // Ensure we don't exceed 25 and have valid structure
        return questions
            .filter((q: any) => q.question && q.searchKeywords)
            .map((q: any) => {
                // If LLM returned an array, pick the first (usually best) element
                // instead of joining, to keep queries high-quality.
                const keywords = Array.isArray(q.searchKeywords) 
                    ? q.searchKeywords[0]
                    : String(q.searchKeywords);
                
                return {
                    question: q.question,
                    category: q.category || 'General',
                    searchKeywords: keywords
                };
            })
            .slice(0, 25);
    } catch (err) {
        console.error('Failed to generate logical questions:', err);
        // Fallback to basic questions if LLM fails
        return [
            { question: `What is the clinical overview of ${termName}?`, category: "General", searchKeywords: termName },
            { question: `What are the latest clinical trial results for ${termName}?`, category: "Clinical", searchKeywords: `${termName} clinical trials` }
        ];
    }
}
