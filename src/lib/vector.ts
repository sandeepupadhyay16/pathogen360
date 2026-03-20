import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { embedText } from './llm';

export async function findSemanticCache(query: string, medicalTermId?: string): Promise<{ response: string; sources: any[] } | null> {
    try {
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const medicalTermFilter = medicalTermId
            ? Prisma.sql`AND "medicalTermId" = ${medicalTermId}`
            : Prisma.empty;

        // Search for cache hits with similarity > 0.98
        const results = await prisma.$queryRaw`
            SELECT "response", "sources", "medicalTermId", 1 - ("embedding" <=> ${embeddingStr}::vector) as similarity
            FROM "SemanticCache"
            WHERE 1 - ("embedding" <=> ${embeddingStr}::vector) > 0.98
            ${medicalTermFilter}
            ORDER BY similarity DESC
            LIMIT 1
        ` as any[];

        if (results.length > 0) {
            return {
                response: results[0].response,
                sources: results[0].sources || []
            };
        }
        return null;
    } catch (error) {
        console.error("Semantic cache lookup failed:", error);
        return null;
    }
}

export async function storeSemanticCache(query: string, response: string, sources: any[], medicalTermId?: string) {
    try {
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        await prisma.$executeRaw`
            INSERT INTO "SemanticCache" ("id", "query", "embedding", "response", "sources", "medicalTermId", "createdAt")
            VALUES (gen_random_uuid(), ${query}, ${embeddingStr}::vector, ${response}, ${JSON.stringify(sources)}::jsonb, ${medicalTermId}, NOW())
        `;
    } catch (error) {
        console.error("Storing semantic cache failed:", error);
    }
}

export async function searchKnowledgeChunks(query: string, medicalTermId: string, limit: number = 10) {
    try {
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const results = await prisma.$queryRaw`
            SELECT "content", "sourceType", "sourceId", 1 - ("embedding" <=> ${embeddingStr}::vector) as similarity
            FROM "KnowledgeChunk"
            WHERE "medicalTermId" = ${medicalTermId}
            ORDER BY similarity DESC
            LIMIT ${limit}
        ` as any[];

        return results;
    } catch (error) {
        console.error("Knowledge search failed:", error);
        return [];
    }
}
