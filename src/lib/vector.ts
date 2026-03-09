import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { embedText } from './llm';

export async function findSemanticCache(query: string, pathogenId?: string) {
    try {
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const pathogenFilter = pathogenId
            ? Prisma.sql`AND "pathogenId" = ${pathogenId}`
            : Prisma.empty;

        // Search for cache hits with similarity > 0.95
        const results = await prisma.$queryRaw`
            SELECT "response", "pathogenId", 1 - ("embedding" <=> ${embeddingStr}::vector) as similarity
            FROM "SemanticCache"
            WHERE 1 - ("embedding" <=> ${embeddingStr}::vector) > 0.98
            ${pathogenFilter}
            ORDER BY similarity DESC
            LIMIT 1
        ` as any[];

        return results.length > 0 ? results[0].response : null;
    } catch (error) {
        console.error("Semantic cache lookup failed:", error);
        return null;
    }
}

export async function storeSemanticCache(query: string, response: string, pathogenId?: string) {
    try {
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        await prisma.$executeRaw`
            INSERT INTO "SemanticCache" ("id", "query", "embedding", "response", "pathogenId", "createdAt")
            VALUES (gen_random_uuid(), ${query}, ${embeddingStr}::vector, ${response}, ${pathogenId}, NOW())
        `;
    } catch (error) {
        console.error("Storing semantic cache failed:", error);
    }
}

export async function searchKnowledgeChunks(query: string, pathogenId: string, limit: number = 10) {
    try {
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;

        const results = await prisma.$queryRaw`
            SELECT "content", "sourceType", "sourceId", 1 - ("embedding" <=> ${embeddingStr}::vector) as similarity
            FROM "KnowledgeChunk"
            WHERE "pathogenId" = ${pathogenId}
            ORDER BY similarity DESC
            LIMIT ${limit}
        ` as any[];

        return results;
    } catch (error) {
        console.error("Knowledge search failed:", error);
        return [];
    }
}
