export async function generateLLMResponse(messages: { role: string; content: string }[], temperature: number = 0.7) {
    const apiKey = process.env.LM_STUDIO_API_KEY || 'google/gemma-3-4b';
    const baseUrl = process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000);

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.LOCAL_LLM_MODEL || apiKey,
                messages: messages,
                temperature: temperature,
                max_tokens: 4096,
                stream: false
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("LM Studio Error Response:", errorBody);
            throw new Error(`LLM Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            model: data.model || process.env.LOCAL_LLM_MODEL || apiKey,
            usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
    } catch (error) {
        console.warn("Local LLM failed or timed out. Attempting cloud fallback via NVIDIA API...", error);

        try {
            const nvidiaTokens = process.env.NVIDIA_API_KEY;
            const nvidiaUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';

            if (!nvidiaTokens) {
                throw new Error("NVIDIA_API_KEY not configured for fallback.");
            }

            const modelName = process.env.CLOUD_LLM_MODEL || "Qwen/Qwen2.5-72B-Instruct";
            const cloudResponse = await fetch(nvidiaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${nvidiaTokens}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: 2048,
                    stream: false
                })
            });

            if (!cloudResponse.ok) {
                const errorBody = await cloudResponse.text();
                console.error("NVIDIA API Error Response:", errorBody);
                throw new Error(`Cloud LLM Error: ${cloudResponse.status}`);
            }

            const data = await cloudResponse.json();
            return {
                content: data.choices[0].message.content,
                model: data.model || modelName,
                usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };

        } catch (cloudError) {
            console.error("Both local and cloud LLMs failed:", cloudError);
            return {
                content: "I am currently unable to reach both the local language model and the cloud fallback API. Please check your network connection or configuration.",
                model: "error-fallback",
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
        }
    }
}

export async function embedText(text: string): Promise<number[]> {
    const apiKey = process.env.LM_STUDIO_API_KEY || 'google/gemma-3-4b';
    const baseUrl = process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(`${baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                input: text,
                model: process.env.LOCAL_EMBEDDING_MODEL || "text-embedding-nomic-embed-text-v1.5"
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Local Embed Error: ${response.status}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (error) {
        console.warn("Local Embedding failed, falling back to NVIDIA...");
        const nvidiaTokens = process.env.NVIDIA_API_KEY;
        const nvidiaUrl = process.env.NVIDIA_API_EMBED_URL || 'https://integrate.api.nvidia.com/v1/embeddings';

        if (!nvidiaTokens) {
            throw new Error("NVIDIA_API_KEY not configured for embedding fallback.");
        }

        const cloudResponse = await fetch(nvidiaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${nvidiaTokens}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                input: [text],
                input_type: "passage",
                model: process.env.CLOUD_EMBEDDING_MODEL || "nvidia/nv-embedqa-e5-v5",
                encoding_format: "float",
                truncate: "NONE"
            })
        });

        if (!cloudResponse.ok) {
            const errorBody = await cloudResponse.text();
            console.error("NVIDIA Embed Error Response:", errorBody);
            throw new Error(`Cloud Embed Error: ${cloudResponse.status}`);
        }

        const data = await cloudResponse.json();
        return data.data[0].embedding;
    }
}

export function stripLLMChatter(text: string): string {
    if (!text) return "";
    
    // Remove "thinking" blocks if present
    let clean = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    
    // Remove common conversational preambles
    const preambles = [
        /^Okay,?/i,
        /^Sure,?/i,
        /^Here is/i,
        /^I have/i,
        /^Based on/i,
        /^Certainly,?/i,
        /^Absolutely,?/i,
        /^I can help with that/i,
        /^I've analyzed/i,
        /^Synthesis Result:/i,
        /^Assistant:/i,
        /^User:/i
    ];

    let lines = clean.split('\n');
    let startingIndex = 0;
    
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim();
        if (preambles.some(p => p.test(line))) {
            startingIndex = i + 1;
        } else if (line.length > 0) {
            break;
        }
    }

    return lines.slice(startingIndex).join('\n').trim();
}
