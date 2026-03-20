import { PARAMETERS, GHO_INDICATORS } from '@/config/parameters';

/**
 * WHO Global Health Observatory (GHO) OData API Client
 * Fetches health indicators for target countries.
 */

const BASE_URL = 'https://ghoapi.azureedge.net/api';

export interface WhoMetric {
    indicator: string;
    value: number;
    year: number;
    location: string;
    unit?: string;
}

async function fetchWhoIndicator(indicatorCode: string): Promise<any[]> {
    try {
        const url = `${BASE_URL}/${indicatorCode}`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data.value || [];
    } catch {
        return [];
    }
}

/**
 * Fetches epidemiology metrics for a given medical term.
 */
export async function fetchWhoMetrics(medicalTermName: string): Promise<WhoMetric[]> {
    const results: WhoMetric[] = [];
    const targetMedicalTerm = medicalTermName.toLowerCase();

    // Mapping medical terms to relevant GHO indicators from central config
    let indicatorCode: string | null = null;

    for (const [key, code] of Object.entries(GHO_INDICATORS.MAPPINGS)) {
        if (targetMedicalTerm.includes(key)) {
            indicatorCode = code;
            break;
        }
    }

    // If no specific indicator found for this term, return empty results
    if (!indicatorCode) {
        return [];
    }

    const rawData = await fetchWhoIndicator(indicatorCode);

    // Filter by target countries and recent years from central config
    const currentYear = new Date().getFullYear();
    const timeframe = PARAMETERS.DATA_FETCHING.MAX_EPI_METRICS; // Assuming this refers to years or count, let's use 10 years as before or similar
    
    const COUNTRY_MAP = PARAMETERS.GEOGRAPHY.WHO_COUNTRY_MAP as Record<string, string>;

    const filtered = rawData.filter(item =>
        COUNTRY_MAP[item.SpatialDim] &&
        parseInt(item.TimeDim) >= currentYear - 10
    );

    for (const item of filtered) {
        results.push({
            indicator: GHO_INDICATORS.LABELS[item.IndicatorCode as keyof typeof GHO_INDICATORS.LABELS] || item.IndicatorCode,
            value: parseFloat(item.NumericValue),
            year: parseInt(item.TimeDim),
            location: COUNTRY_MAP[item.SpatialDim],
            unit: item.Value // Descriptive value string e.g. "82.5"
        });
    }

    return results;
}
