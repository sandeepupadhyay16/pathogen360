/**
 * Simple utility to pause execution for a given number of milliseconds.
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Global NCBI Rate Limiter to ensure we respect the 3 requests/sec limit
 * for public users (no API key).
 */
class RateLimiter {
    private lastRequestTime: number = 0;
    private minInterval: number;

    constructor(requestsPerSecond: number = 2) {
        this.minInterval = 1000 / requestsPerSecond;
    }

    async throttle() {
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        if (timeSinceLast < this.minInterval) {
            const delay = this.minInterval - timeSinceLast;
            await sleep(delay);
        }
        this.lastRequestTime = Date.now();
    }
}

// Global instance for NCBI (PubMed/PMC/OAI)
export const ncbilt = new RateLimiter(1.5); // Very conservative: 1.5 req/sec

/**
 * Standardized fetch with exponential backoff for 429 and 5xx errors.
 */
export async function fetchWithRetry(url: string, options: RequestInit = {}, retries: number = 5): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            
            if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
                const delay = Math.min(2000 * Math.pow(2, i), 30000); // Max 30s backoff
                console.warn(`[API] Status ${response.status} on ${url}. Retrying in ${delay}ms... (${i + 1}/${retries})`);
                await sleep(delay);
                continue;
            }
            
            return response;
        } catch (err: any) {
            if (i === retries - 1) throw err;
            const delay = 2000 * Math.pow(2, i);
            console.warn(`[API] Network error on ${url}: ${err.message}. Retrying...`);
            await sleep(delay);
        }
    }
    return fetch(url, options); // Final fallback
}
