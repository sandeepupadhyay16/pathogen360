import { prisma } from './prisma';
import { embedText } from './llm';

interface AliasEntry {
  alias: string;
  canonicalName: string;
  confidence: number;
  description?: string;
}

interface FuzzyPattern {
  pattern: string;
  canonicalName: string;
  description?: string;
}

interface ResolutionResult {
  found: boolean;
  canonicalName: string;
  matchedAlias?: string;
  confidence: number;
  isFuzzyMatch: boolean;
}

export class PathogenResolver {
  private registry: string[];
  private loaded = false;

  constructor() {
    this.aliases = [];
    this.fuzzyPatterns = [];
    this.registry = [];
    this.loadAliases();
  }

  private async loadAliases(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const aliasesPath = path.join(process.cwd(), 'src/config/pathogen-aliases.json');
      
      if (fs.existsSync(aliasesPath)) {
        const data = JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
        this.aliases = data.aliases || [];
        this.fuzzyPatterns = data.fuzzyMatches || [];
        console.log(`Loaded ${this.aliases.length} pathogen aliases and ${this.fuzzyPatterns.length} fuzzy patterns`);
      }

      const registryPath = path.join(process.cwd(), 'src/config/pathogen-registry.json');
      if (fs.existsSync(registryPath)) {
        const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        this.registry = data.pathogens || [];
        console.log(`Loaded ${this.registry.length} pathogens from master registry`);
      }
    } catch (err) {
      console.warn('Could not load pathogen data:', err);
    }
    this.loaded = true;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      return await embedText(text);
    } catch (err) {
      console.warn('Failed to generate embedding:', err);
      return new Array(768).fill(0);
    }
  }

  private calculateSimilarity(embed1: number[], embed2: number[]): number {
    if (embed1.length === 0 || embed2.length === 0) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < Math.min(embed1.length, embed2.length); i++) {
      dotProduct += embed1[i] * embed2[i];
      norm1 += embed1[i] * embed1[i];
      norm2 += embed2[i] * embed2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  private async findExactMatch(query: string): Promise<ResolutionResult | null> {
    const normalizedQuery = this.normalizeText(query);

    for (const alias of this.aliases) {
      if (this.normalizeText(alias.alias) === normalizedQuery || 
          this.normalizeText(alias.canonicalName) === normalizedQuery) {
        return {
          found: true,
          canonicalName: alias.canonicalName,
          matchedAlias: alias.alias,
          confidence: alias.confidence,
          isFuzzyMatch: false
        };
      }
    }

    // Also check master registry
    for (const name of this.registry) {
      if (this.normalizeText(name) === normalizedQuery || normalizedQuery.includes(this.normalizeText(name))) {
        return {
          found: true,
          canonicalName: name,
          confidence: this.normalizeText(name) === normalizedQuery ? 1.0 : 0.9,
          isFuzzyMatch: false
        };
      }
    }

    return null;
  }

  private async findRegexMatch(query: string): Promise<ResolutionResult | null> {
    for (const pattern of this.fuzzyPatterns) {
      try {
        const regex = new RegExp(pattern.pattern, 'i');
        if (regex.test(query)) {
          return {
            found: true,
            canonicalName: pattern.canonicalName,
            confidence: 0.95,
            isFuzzyMatch: true
          };
        }
      } catch (err) {
        continue;
      }
    }

    return null;
  }

  private async findSemanticMatch(query: string): Promise<ResolutionResult | null> {
    try {
      const queryEmbedding = await this.getEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Perform vector similarity search in the database
      const results = await prisma.$queryRaw`
        SELECT "name", "pathogenId", "isAlias", 1 - ("embedding" <=> ${embeddingStr}::vector) as similarity
        FROM "PathogenNameEmbedding"
        WHERE 1 - ("embedding" <=> ${embeddingStr}::vector) > 0.75
        ORDER BY similarity DESC
        LIMIT 1
      ` as any[];

      if (results.length > 0) {
        const best = results[0];
        // If it's an alias, the name is stored as "alias|canonicalName"
        let canonicalName = best.name;
        let matchedAlias = undefined;

        if (best.isAlias && best.name.includes('|')) {
          const parts = best.name.split('|');
          matchedAlias = parts[0];
          canonicalName = parts[1];
        } else if (best.pathogenId) {
          // If we have a pathogenId, get the canonical name from the Pathogen table
          const pathogen = await prisma.pathogen.findUnique({
            where: { id: best.pathogenId }
          });
          if (pathogen) {
            canonicalName = pathogen.name;
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

    // Fallback to in-memory for loaded aliases if DB search fails or returns nothing
    let bestMatch: ResolutionResult | null = null;
    let bestSimilarity = 0.85;
    const queryEmbedding = await this.getEmbedding(query);

    for (const alias of this.aliases) {
      if (!alias.canonicalName) continue;

      const aliasEmbedding = await this.getEmbedding(alias.alias);
      const similarity = this.calculateSimilarity(queryEmbedding, aliasEmbedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = {
          found: true,
          canonicalName: alias.canonicalName,
          matchedAlias: alias.alias,
          confidence: Math.min(similarity * 1.2, 0.99),
          isFuzzyMatch: true
        };
      }
    }

    return bestMatch;
  }

  private async resolveFromDatabase(query: string): Promise<ResolutionResult | null> {
    try {
      const normalizedQuery = this.normalizeText(query);
      
      const result = await prisma.pathogen.findFirst({
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

      const embeddingResult = await prisma.pathogenNameEmbedding.findFirst({
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

  public async resolve(query: string): Promise<ResolutionResult> {
    if (!this.loaded) await this.loadAliases();

    const normalizedQuery = this.normalizeText(query);

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return { found: false, canonicalName: query, confidence: 0, isFuzzyMatch: false };
    }

    console.log(`Resolving pathogen for: "${query}"`);

    // 1. In-memory Alias Match (fastest)
    let result = await this.findExactMatch(query);
    if (result && result.confidence >= 0.98) {
      console.log(`- Exact alias match: ${result.canonicalName}`);
      this.updateUsageCount(result.canonicalName);
      return result;
    }

    // 2. Database Exact/Contains Match
    const dbMatch = await this.resolveFromDatabase(query);
    if (dbMatch && dbMatch.confidence >= 0.95) {
      console.log(`- Database match: ${dbMatch.canonicalName}`);
      this.updateUsageCount(dbMatch.canonicalName);
      return dbMatch;
    }

    // 3. Regex Match
    const regexMatch = await this.findRegexMatch(query);
    if (regexMatch) {
      console.log(`- Regex match: ${regexMatch.canonicalName}`);
      this.updateUsageCount(regexMatch.canonicalName);
      return regexMatch;
    }

    // 4. Semantic vector match (most expensive but highest coverage)
    const semanticMatch = await this.findSemanticMatch(query);
    if (semanticMatch && semanticMatch.confidence > 0.8) {
      console.log(`- Semantic match: ${semanticMatch.canonicalName} (conf: ${semanticMatch.confidence.toFixed(2)})`);
      this.updateUsageCount(semanticMatch.canonicalName);
      // Auto-cache the successful semantic match to DB
      if (semanticMatch.confidence > 0.9) {
        this.upsertPathogenEmbedding(semanticMatch.canonicalName, query);
      }
      return semanticMatch;
    }

    console.log(`- No pathogen match found for: "${query}"`);
    return { found: false, canonicalName: query, confidence: 0, isFuzzyMatch: false };
  }

  private async updateUsageCount(pathogenName: string): Promise<void> {
    try {
      // Find the embedding record and increment usage
      const embedding = await prisma.pathogenNameEmbedding.findFirst({
        where: { 
          OR: [
            { name: { equals: pathogenName, mode: 'insensitive' } },
            { name: { endsWith: `|${pathogenName}`, mode: 'insensitive' } }
          ]
        }
      });

      if (embedding) {
        await prisma.pathogenNameEmbedding.update({
          where: { id: embedding.id },
          data: { usageCount: { increment: 1 } }
        });
      }
    } catch (err) {
      // Silently fail usage updates
    }
  }

  public async upsertPathogenEmbedding(pathogenName: string, alias?: string): Promise<void> {
    if (!pathogenName) return;

    try {
      const nameKey = alias ? `${alias}|${pathogenName}` : pathogenName;
      const embedding = await this.getEmbedding(alias || pathogenName);
      const embeddingStr = `[${embedding.join(',')}]`;
      const pathogenId = await this.getPathogenId(pathogenName);

      const existing = await prisma.pathogenNameEmbedding.findFirst({
        where: { name: { equals: nameKey, mode: 'insensitive' } }
      });

      if (existing) {
        await prisma.$executeRaw`
          UPDATE "PathogenNameEmbedding"
          SET "embedding" = ${embeddingStr}::vector,
              "isAlias" = ${!!alias},
              "usageCount" = "usageCount" + 1,
              "pathogenId" = ${pathogenId}
          WHERE "id" = ${existing.id}
        `;
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PathogenNameEmbedding" ("id", "name", "embedding", "isAlias", "pathogenId", "usageCount", "createdAt")
          VALUES (gen_random_uuid(), ${nameKey}, ${embeddingStr}::vector, ${!!alias}, ${pathogenId}, 1, NOW())
        `;
      }
    } catch (err) {
      console.warn('Failed to upsert embedding:', err);
    }
  }

  private async getPathogenId(name: string): Promise<string | null> {
    try {
      const pathogen = await prisma.pathogen.findUnique({
        where: { name }
      });
      return pathogen?.id || null;
    } catch {
      return null;
    }
  }
}

export const pathogenResolver = new PathogenResolver();
