/**
 * Synthesize All Pathogens
 * Calls the /api/synthesize endpoint with { all: true } and streams progress.
 */

const ENDPOINT = 'http://localhost:3000/api/synthesize';

async function main() {
    console.log('🔬 Starting full synthesis for all pathogens...');
    console.log('   This may take a while — each pathogen requires LLM inference.');
    console.log('   Progress will be streamed below:\n');

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
    });

    if (!response.ok) {
        console.error(`❌ HTTP error! status: ${response.status}`);
        process.exit(1);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // All complete lines except the last (which may be partial)
        buffer = lines.pop();

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                const progress = parsed.progress ?? '?';
                const message = parsed.message ?? '';
                const bar = '[' + '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5)) + ']';
                console.log(`  ${bar} ${progress}% — ${message}`);
            } catch (e) {
                // Raw line, just print it
                console.log(`  [raw] ${line}`);
            }
        }
    }

    // Flush any remaining buffer
    if (buffer.trim()) {
        try {
            const parsed = JSON.parse(buffer);
            console.log(`  ✅ ${parsed.message}`);
        } catch {
            console.log(`  [raw] ${buffer}`);
        }
    }

    console.log('\n✅ Synthesis complete! Visit /admin to view results.');
}

main().catch(err => {
    console.error('❌ Synthesis failed:', err.message);
    process.exit(1);
});
