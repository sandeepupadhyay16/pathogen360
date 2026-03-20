import { XMLParser } from 'fast-xml-parser';
import { sleep, fetchWithRetry, ncbilt } from './utils';

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PMC_OA_URL = 'https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi';

/**
 * Enhanced fetch wrapper using global NCBI rate limiter.
 */
async function fetchNCBI(url: string, retries: number = 5): Promise<Response> {
    await ncbilt.throttle();
    return fetchWithRetry(url, {}, retries);
}

/**
 * Searches PubMed for the given medical term.
 */
export async function searchPubMed(query: string, maxResults: number = 50, startYear?: number, endYear?: number): Promise<string[]> {
    const currentYear = endYear || new Date().getFullYear();
    const pastYear = startYear || (currentYear - 10);
    const dateRange = `("${pastYear}/01/01"[Date - Publication] : "${currentYear}/12/31"[Date - Publication])`;
    
    // Generic medical search query without specific filters
    const fullQuery = `(${query}) AND ${dateRange}`;

    // Cap maxResults at 1000 for prototype stability
    const finalMax = Math.min(maxResults, 1000);

    const searchUrl = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(fullQuery)}&retmax=${finalMax}&retmode=json`;

    const response = await fetchNCBI(searchUrl);
    if (!response.ok) {
        throw new Error(`Failed to search PubMed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.esearchresult.idlist || [];
}

export interface PubMedArticle {
    pubmedId: string;
    pmcId: string | null;
    hasFullText: boolean;
    title: string;
    abstractText: string | null;
    authors: string | null;
    publicationDate: string | null;
    countryAffiliations: string | null;
}

/**
 * Attempts to fetch full article text from PMC Open Access API.
 * Returns null if the article is not in PMC OA or the fetch fails.
 */
async function fetchPmcFullText(pmcId: string): Promise<string | null> {
    try {
        const url = `${PMC_OA_URL}?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmcId.replace('PMC', '')}&metadataPrefix=pmc`;
        const response = await fetchNCBI(url);
        if (!response.ok) return null;

        const xml = await response.text();

        // Check for OAI errors (e.g. idDoesNotExist)
        if (xml.includes('<error') || xml.includes('noRecordsMatch')) return null;

        // Extract all <p> paragraph content from the <body> section
        const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (!bodyMatch) return null;

        // Strip XML tags and clean whitespace
        const bodyText = bodyMatch[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (bodyText.length < 200) return null; // Too short, likely parsing failed

        // Cap at 50K chars as a safety guard against malformed XML; the synthesis pipeline
        // handles arbitrarily long text via per-article chunked summarization.
        return bodyText.length > 50000
            ? bodyText.slice(0, 50000) + '... [truncated at 50K chars]'
            : bodyText;
    } catch {
        return null;
    }
}

/**
 * Fetches details for a list of PubMed IDs.
 * Automatically attempts PMC full-text retrieval for articles with a PMC ID if requested.
 */
export async function fetchPubMedDetails(ids: string[], fetchFullText: boolean = true): Promise<PubMedArticle[]> {
    if (ids.length === 0) return [];

    const CHUNK_SIZE = 100;
    const results: PubMedArticle[] = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const fetchUrl = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${chunk.join(',')}&retmode=xml`;

        try {
            const response = await fetchNCBI(fetchUrl);
            if (!response.ok) {
                console.error(`Failed to fetch chunk: ${response.statusText}`);
                continue;
            }

            const xmlData = await response.text();
            const parser = new XMLParser({
                ignoreAttributes: false,
                parseAttributeValue: true,
                isArray: (name) => ['PubmedArticle', 'Author', 'AbstractText', 'ArticleId'].indexOf(name) !== -1,
            });

            const parsed = parser.parse(xmlData);
            const articlesSet = parsed.PubmedArticleSet?.PubmedArticle || [];

            for (const item of articlesSet) {
                const citation = item.MedlineCitation;
                const rawId = citation?.PMID?.['#text'] || citation?.PMID?.toString() || citation?.PMID;
                const pubmedId = String(rawId);
                const article = citation?.Article;
                const rawTitle = article?.ArticleTitle;
                const title = typeof rawTitle === 'string' ? rawTitle : (rawTitle?.['#text'] || JSON.stringify(rawTitle) || '');

                let pmcId: string | null = null;
                const articleIds = item.PubmedData?.ArticleIdList?.ArticleId || [];
                for (const aid of articleIds) {
                    const idType = aid?.['@_IdType'];
                    const idVal = aid?.['#text'] || String(aid);
                    if (idType === 'pmc' && idVal) {
                        pmcId = idVal.startsWith('PMC') ? idVal : `PMC${idVal}`;
                        break;
                    }
                }

                let abstractText = null;
                if (article?.Abstract?.AbstractText) {
                    if (Array.isArray(article.Abstract.AbstractText)) {
                        abstractText = article.Abstract.AbstractText.map((t: any) => typeof t === 'string' ? t : t['#text']).join(' ');
                    } else {
                        abstractText = typeof article.Abstract.AbstractText === 'string' ? article.Abstract.AbstractText : article.Abstract.AbstractText['#text'];
                    }
                }

                let hasFullText = false;
                let fullContent = abstractText;
                if (pmcId && fetchFullText) {
                    const pmcText = await fetchPmcFullText(pmcId);
                    if (pmcText) {
                        fullContent = `[Full Text via PMC Open Access]\n\n${pmcText}`;
                        hasFullText = true;
                    }
                }

                let authors = null;
                let countryAffiliations = null;
                if (article?.AuthorList?.Author) {
                    authors = article.AuthorList.Author.map((a: any) => `${a.LastName} ${a.Initials}`).join(', ');
                    const affiliations = article.AuthorList.Author
                        .map((a: any) => a.AffiliationInfo?.Affiliation)
                        .filter(Boolean)
                        .join(' ');

                    // Refined country identification using a mapping of target regions.
                    // This prevents messy hospital/uni names from polluting the region filter.
                    const countryMap: Record<string, string[]> = {
                        'China': ['China', 'Beijing', 'Shanghai', 'Guangzhou', 'PRC'],
                        'Japan': ['Japan', 'Tokyo', 'Osaka', 'Kyoto'],
                        'Germany': ['Germany', 'Deutschland', 'Berlin', 'Munich', 'Hamburg'],
                        'USA': ['USA', 'United States', 'California', 'New York', 'Texas', 'Boston'],
                        'UK': ['UK', 'United Kingdom', 'London', 'England', 'Oxford', 'Cambridge', 'Great Britain'],
                        'France': ['France', 'Paris', 'Lyon'],
                        'Switzerland': ['Switzerland', 'Swiss', 'Zurich', 'Geneva', 'Basel'],
                        'Italy': ['Italy', 'Rome', 'Milan'],
                        'Canada': ['Canada', 'Toronto', 'Montreal', 'Vancouver']
                    };

                    const foundRegions = new Set<string>();
                    for (const [region, variants] of Object.entries(countryMap)) {
                        if (variants.some(v => affiliations.includes(v))) {
                            foundRegions.add(region);
                        }
                    }

                    if (foundRegions.size > 0) {
                        countryAffiliations = Array.from(foundRegions).join(', ');
                    }
                }

                let pubYear = article?.Journal?.JournalIssue?.PubDate?.Year;
                if (!pubYear && article?.Journal?.JournalIssue?.PubDate?.MedlineDate) {
                    pubYear = article.Journal.JournalIssue.PubDate.MedlineDate.substring(0, 4);
                }

                results.push({
                    pubmedId,
                    pmcId,
                    hasFullText,
                    title,
                    abstractText: fullContent || null,
                    authors: authors || null,
                    publicationDate: pubYear ? new Date(`${pubYear}-01-01`).toISOString() : null,
                    countryAffiliations: countryAffiliations || null,
                });
            }
        } catch (err) {
            console.error('Error fetching details chunk:', err);
        }
    }

    return results;
}

