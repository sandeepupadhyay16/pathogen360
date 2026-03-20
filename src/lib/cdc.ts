/**
 * CDC Surveillance & MMWR Metadata Client
 */

const CDC_SOCRATA_BASE = 'https://data.cdc.gov/resource';
const MMWR_METADATA_URL = `${CDC_SOCRATA_BASE}/7rih-tqi5.json`; // CDC Text Corpora: MMWR, EID, and PCD Article Metadata

export interface SurveillanceAlert {
    source: string;
    title: string;
    description?: string;
    url?: string;
    publishedAt: Date;
    severity?: string;
}

/**
 * Fetches recent MMWR alerts for a specific medical term.
 */
export async function fetchCdcAlerts(medicalTermName: string): Promise<SurveillanceAlert[]> {
    try {
        // Strip common suffixes to improve search results
        const searchTerm = medicalTermName.toLowerCase()
            .replace(/\s+virus$/i, '')
            .replace(/\s+bacteria$/i, '')
            .replace(/\s+pathogen$/i, '');

        // Search metadata for medical term name in title
        const query = `$where=lower(title) like '%25${searchTerm}%25'`;
        const url = `${MMWR_METADATA_URL}?${query}&$limit=10&$order=dl_year_mo desc`;

        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();

        return data.map((item: any) => ({
            source: 'CDC (MMWR/EID)',
            title: item.title?.split('|')[0]?.trim() || 'CDC Alert',
            description: item.md_desc || item.string || 'No description available',
            url: item.url?.url || item.link_canon || (item.mirror_path ? `https://www.cdc.gov${item.mirror_path}` : undefined),
            publishedAt: item.dl_date ? new Date(item.dl_date) : (item.dl_year_mo ? new Date(item.dl_year_mo) : new Date()),
            severity: (item.title?.toLowerCase().includes('outbreak') || item.md_desc?.toLowerCase().includes('emergency')) ? 'High' : 'Medium'
        }));
    } catch (err) {
        console.error('CDC Alert fetch failed:', err);
        return [];
    }
}
