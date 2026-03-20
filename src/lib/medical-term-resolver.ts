import { prisma } from './prisma';
import { embedText, generateText } from './llm';

interface ResolutionResult {
  found: boolean;
  canonicalName: string;
  matchedAlias?: string;
  confidence: number;
  isFuzzyMatch: boolean;
}

export class MedicalTermResolver {
  private loaded = false;

  constructor() {
    this.loaded = true;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/['’]s\b/g, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async normalizeAndCompare(a: string, b: string): Promise<boolean> {
    const na = a.toLowerCase().replace(/['’]s\b/g, '').replace(/[^\w]/g, '');
    const nb = b.toLowerCase().replace(/['’]s\b/g, '').replace(/[^\w]/g, '');
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      return await embedText(text);
    } catch (err) {
      console.warn('Failed to generate embedding:', err);
      return new Array(768).fill(0);
    }
  }

  private async findSemanticMatch(query: string): Promise<ResolutionResult | null> {
    try {
      const queryEmbedding = await this.getEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Perform vector similarity search in the database
      const results = await prisma.$queryRaw`
        SELECT "name", "medicalTermId", "isAlias", 1 - ("embedding" <=> ${embeddingStr}::vector) as similarity
        FROM "MedicalTermEmbedding"
        WHERE 1 - ("embedding" <=> ${embeddingStr}::vector) > 0.85
        ORDER BY similarity DESC
        LIMIT 1
      ` as any[];

      if (results.length > 0) {
        const best = results[0];
        let canonicalName = best.name;
        let matchedAlias = undefined;

        if (best.isAlias && best.name.includes('|')) {
          const parts = best.name.split('|');
          matchedAlias = parts[0];
          canonicalName = parts[1];
        } else if (best.medicalTermId) {
          const term = await prisma.medicalTerm.findUnique({
            where: { id: best.medicalTermId }
          });
          if (term) {
            canonicalName = term.name;
          }
        }

        return {
          found: true,
          canonicalName: canonicalName,
          matchedAlias: matchedAlias,
          confidence: Math.min(best.similarity * 1.1, 0.99),
          isFuzzyMatch: true
        };
      }
    } catch (err) {
      console.warn('Semantic match query failed:', err);
    }

    return null;
  }

  private async resolveFromDatabase(query: string): Promise<ResolutionResult | null> {
    try {
      const normalizedQuery = this.normalizeText(query);
      
      const result = await prisma.medicalTerm.findFirst({
        where: {
          OR: [
            { name: { equals: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } }
          ]
        }
      });

      if (result) {
        return {
          found: true,
          canonicalName: result.name,
          confidence: result.name.toLowerCase() === normalizedQuery ? 1.0 : 0.95,
          isFuzzyMatch: false
        };
      }

      const embeddingResult = await prisma.medicalTermEmbedding.findFirst({
        where: {
          OR: [
            { name: { equals: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } }
          ]
        }
      });

      if (embeddingResult) {
        let canonicalName = embeddingResult.name;
        let matchedAlias = undefined;
        
        if (embeddingResult.isAlias && embeddingResult.name.includes('|')) {
          const parts = embeddingResult.name.split('|');
          matchedAlias = parts[0];
          canonicalName = parts[1];
        }

        return {
          found: true,
          canonicalName: canonicalName,
          matchedAlias: matchedAlias,
          confidence: 0.92,
          isFuzzyMatch: false
        };
      }

      return null;
    } catch (err) {
      console.warn('Database query failed:', err);
      return null;
    }
  }

  private async resolveByInclusion(query: string): Promise<ResolutionResult | null> {
    try {
      const terms = await prisma.medicalTerm.findMany({ select: { name: true } });
      const lowerQuery = query.toLowerCase();
      
      // Sort by length descending to match most specific/longest terms first
      const sortedTerms = terms.sort((a, b) => b.name.length - a.name.length);
      
      for (const term of sortedTerms) {
        const lowerName = term.name.toLowerCase();
        // Check if query contains the term name as a distinct word/phrase
        const pattern = new RegExp(`\\b${lowerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        
        if (pattern.test(lowerQuery)) {
          return {
            found: true,
            canonicalName: term.name,
            confidence: 0.98,
            isFuzzyMatch: false
          };
        }
      }
    } catch (err) {
      console.warn('Inclusion match failed:', err);
    }
    return null;
  }

  private async extractEntityWithLLM(query: string): Promise<string | null> {
    try {
      const terms = await prisma.medicalTerm.findMany({ select: { name: true } });
      const termList = terms.map(t => `- ${t.name}`).join('\n');

      const prompt = `You are a medical entity mapper. Extract the primary medical term (disease, drug, virus, etc.) from the query.
Available Onboarded Terms:
${termList || 'NONE'}

User Query: "${query}"

Rules:
1. If the entity in the query matches or is a variation of an "Available Onboarded Term" (e.g., "Alzheimer's" -> "Alzheimers", "PD" -> "Parkinsons"), YOU MUST return that EXACT onboarded name.
2. If the user asks about a secondary concept RELATED to an onboarded term (e.g., "Covid vaccine", "Long Covid", "Covid symptoms" -> "COVID-19"), YOU MUST return the EXHIBITED PARENT onboarded name.
3. If it is a completely new entity, return its canonical name.
4. If no entity is found, return "NONE".

Return ONLY the name:`;

      const response = await generateText(prompt);
      const entity = response.trim().replace(/^["']|["']$/g, '');
      
      if (entity.toUpperCase() === 'NONE' || entity.length < 2) return null;
      return entity;
    } catch (err) {
      console.warn('LLM entity extraction failed:', err);
      return null;
    }
  }

  public async resolve(query: string): Promise<ResolutionResult> {
    const normalizedQuery = this.normalizeText(query);

    if (!normalizedQuery || (normalizedQuery.length < 2 && !/\d/.test(normalizedQuery))) {
      return { found: false, canonicalName: query, confidence: 0, isFuzzyMatch: false };
    }

    console.log(`Resolving medical term for: "${query}"`);

    // 1. Database Exact/Contains Match
    const dbMatch = await this.resolveFromDatabase(query);
    if (dbMatch && dbMatch.confidence >= 0.95) {
      console.log(`- Database match: ${dbMatch.canonicalName}`);
      this.updateUsageCount(dbMatch.canonicalName);
      return dbMatch;
    }

    // 2. Inclusion Match (Is the term inside the query?)
    const inclusionMatch = await this.resolveByInclusion(query);
    if (inclusionMatch) {
      console.log(`- Inclusion match: ${inclusionMatch.canonicalName}`);
      this.updateUsageCount(inclusionMatch.canonicalName);
      return inclusionMatch;
    }

    // 3. Semantic vector match
    const semanticMatch = await this.findSemanticMatch(query);
    if (semanticMatch && semanticMatch.confidence > 0.85) {
      console.log(`- Semantic match: ${semanticMatch.canonicalName} (conf: ${semanticMatch.confidence.toFixed(2)})`);
      this.updateUsageCount(semanticMatch.canonicalName);
      if (semanticMatch.confidence > 0.95) {
        this.upsertMedicalTermEmbedding(semanticMatch.canonicalName, query);
      }
      return semanticMatch;
    }

    // 4. LLM-assisted entity extraction & semantic mapping
    const extractedEntity = await this.extractEntityWithLLM(query);
    if (extractedEntity) {
      console.log(`- LLM result: "${extractedEntity}"`);
      
      // Check if LLM returned an exact match from DB
      const dbMatch = await this.resolveFromDatabase(extractedEntity);
      if (dbMatch) {
         console.log(`- LLM-mapped DB match: ${dbMatch.canonicalName}`);
         return { ...dbMatch, confidence: 0.95 };
      }

      // Check for inclusion again with the extracted entity
      const inclusion = await this.resolveByInclusion(extractedEntity);
      if (inclusion) {
        console.log(`- LLM-mapped inclusion match: ${inclusion.canonicalName}`);
        return { ...inclusion, confidence: 0.92 };
      }

      // Final attempt: normalized string comparison for "fuzzy" match
      const terms = await prisma.medicalTerm.findMany({ select: { name: true } });
      for (const term of terms) {
        if (await this.normalizeAndCompare(extractedEntity, term.name)) {
          console.log(`- LLM+Normalized match: ${term.name}`);
          return { found: true, canonicalName: term.name, confidence: 0.88, isFuzzyMatch: true };
        }
      }
    }

    console.log(`- No medical term match found for: "${query}"`);
    return { found: false, canonicalName: query, confidence: 0, isFuzzyMatch: false };
  }

  private async updateUsageCount(termName: string): Promise<void> {
    try {
      const embedding = await prisma.medicalTermEmbedding.findFirst({
        where: { 
          OR: [
            { name: { equals: termName, mode: 'insensitive' } },
            { name: { endsWith: `|${termName}`, mode: 'insensitive' } }
          ]
        }
      });

      if (embedding) {
        await prisma.medicalTermEmbedding.update({
          where: { id: embedding.id },
          data: { usageCount: { increment: 1 } }
        });
      }
    } catch (err) {
      // Silently fail
    }
  }

  public async upsertMedicalTermEmbedding(termName: string, alias?: string): Promise<void> {
    if (!termName) return;

    try {
      const nameKey = alias ? `${alias}|${termName}` : termName;
      const embedding = await this.getEmbedding(alias || termName);
      const embeddingStr = `[${embedding.join(',')}]`;
      const medicalTermId = await this.getMedicalTermId(termName);

      const existing = await prisma.medicalTermEmbedding.findFirst({
        where: { name: { equals: nameKey, mode: 'insensitive' } }
      });

      if (existing) {
        await prisma.$executeRaw`
          UPDATE "MedicalTermEmbedding"
          SET "embedding" = ${embeddingStr}::vector,
              "isAlias" = ${!!alias},
              "usageCount" = "usageCount" + 1,
              "medicalTermId" = ${medicalTermId}
          WHERE "id" = ${existing.id}
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "MedicalTermEmbedding" ("id", "name", "embedding", "isAlias", "medicalTermId", "usageCount", "createdAt")
          VALUES (gen_random_uuid(), ${nameKey}, ${embeddingStr}::vector, ${!!alias}, ${medicalTermId}, 1, NOW())
        `;
      }
    } catch (err) {
      console.warn('Failed to upsert embedding:', err);
    }
  }

  private async getMedicalTermId(name: string): Promise<string | null> {
    try {
      const term = await prisma.medicalTerm.findUnique({
        where: { name }
      });
      return term?.id || null;
    } catch {
      return null;
    }
  }
}

export const medicalTermResolver = new MedicalTermResolver();
