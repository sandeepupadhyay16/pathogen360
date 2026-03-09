const fs = require('fs');
const path = require('path');

// Mocking the LLM function for the script to use the project's logic
// We'll use fetch directly to NVIDIA as per the llm.ts logic
async function generateLLMResponse(messages) {
    const apiKey = process.env.LM_STUDIO_API_KEY || 'openai/gpt-oss-20b';
    const baseUrl = process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';

    try {
        console.log(`Attempting local LLM at ${baseUrl}...`);
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: apiKey,
                messages: messages,
                temperature: 0.1,
                max_tokens: 4096,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Local LLM Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (err) {
        console.warn("Local LLM failed, falling back to NVIDIA...", err.message);
        const nvidiaTokens = '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';
        const nvidiaUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

        const cloudResponse = await fetch(nvidiaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${nvidiaTokens}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: "Qwen/Qwen2.5-72B-Instruct",
                messages: messages,
                temperature: 0.1,
                max_tokens: 4096,
                stream: false
            })
        });

        if (!cloudResponse.ok) {
            throw new Error(`Cloud LLM Error: ${cloudResponse.status}`);
        }

        const data = await cloudResponse.json();
        return data.choices[0].message.content;
    }
}

const REGISTRY_PATH = path.join(__dirname, '../src/config/pathogen-registry.json');
const TAXONOMY_PATH = path.join(__dirname, '../src/config/pathogen-taxonomy.json');

async function main() {
    console.log("Loading current registry...");
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(raw);
    const originalPathogens = registry.pathogens;

    console.log(`Original count: ${originalPathogens.length}`);

    const prompt = `You are a biological taxonomist. I have a list of pathogen names that contains duplicates, aliases, and overlaps (e.g., "Measles" and "Measles Virus", "Zika" and "Zika Virus", and various Influenza strains).

Your task:
1. Deduplicate the list by choosing the most standard scientific or common name.
2. For each unique pathogen, provide its:
   - name (Canonical Name)
   - type (Virus, Bacteria, Fungus, Parasite)
   - family (Taxonomic Family)
3. Group the results by Type.
4. Format the output as a valid JSON object with the following structure:
{
  "pathogens": [
    { "name": "...", "type": "...", "family": "..." },
    ...
  ]
}

Input Pathogens:
${originalPathogens.join(', ')}

Respond ONLY with the raw JSON object. No markdown, no explanation.`;

    console.log("Requesting taxonomy from LLM...");
    try {
        const response = await generateLLMResponse([
            { role: 'system', content: 'You are an expert microbiologist.' },
            { role: 'user', content: prompt }
        ]);

        // Clean up response if LLM added markdown backticks
        const cleanedResponse = response.replace(/^```json/, '').replace(/```$/, '').trim();
        const taxonomy = JSON.parse(cleanedResponse);

        console.log(`Generated taxonomy for ${taxonomy.pathogens.length} unique pathogens.`);

        // Save new taxonomy file
        fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2) + '\n');
        console.log(`Master taxonomy saved to: ${TAXONOMY_PATH}`);

        // Update registry to be a flat list from the taxonomy names
        const newRegistry = {
            pathogens: taxonomy.pathogens.map(p => p.name).sort(),
            defaultScanDepth: registry.defaultScanDepth || 50
        };
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(newRegistry, null, 2) + '\n');
        console.log(`Consolidated registry updated at: ${REGISTRY_PATH}`);

    } catch (err) {
        console.error("Failed to generate taxonomy:", err);
    }
}

main();
