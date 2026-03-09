const failedPathogens = [
    "Lassa Virus",
    "Rift Valley Fever Virus",
    "HIV-1",
    "Epstein-Barr Virus",
    "Poliovirus",
    "Coxiella burnetii",
    "Corynebacterium diphtheriae",
    "Clostridioides difficile",
    "Acinetobacter baumannii",
    "Leishmania donovani",
    "Candida auris"
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ingestPathogen(name, attempt = 1) {
    console.log(`[Attempt ${attempt}] Redoing ingestion for: ${name}`);
    try {
        const response = await fetch('http://localhost:3000/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pathogenName: name, maxResults: 20 })
        });

        if (response.status === 429) {
            console.warn(`Rate limit hit for ${name}. Sleeping 10s...`);
            await sleep(10000);
            if (attempt < 4) return ingestPathogen(name, attempt + 1);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            if (text.includes("Too Many Requests") || text.includes("Request-URI Too Long")) {
                console.warn(`Error detected in stream for ${name}: ${text}`);
            }
        }

        console.log(`Successfully finished redo for: ${name}`);
    } catch (error) {
        console.error(`Failed to redo ${name}:`, error.message);
        if (attempt < 4 && (error.message.includes("429") || error.message.includes("Too Many Requests"))) {
            await sleep(10000 * attempt);
            return ingestPathogen(name, attempt + 1);
        }
    }
}

async function main() {
    console.log(`Repairing hydration for ${failedPathogens.length} pathogens...`);

    for (const pathogen of failedPathogens) {
        await ingestPathogen(pathogen);
        await sleep(5000); // 5s gap to be extra safe
    }

    console.log("Repair hydration complete!");
}

main();
