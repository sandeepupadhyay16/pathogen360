
/**
 * Application-wide configuration parameters and defaults.
 * This file replaces hardcoded values previously scattered across the codebase.
 */

export const PARAMETERS = {
    DATA_FETCHING: {
        MAX_ARTICLES: 50,
        MAX_TRIALS: 30,
        MAX_EPI_METRICS: 100,
        MAX_SURVEILLANCE_ALERTS: 20,
        DEFAULT_PUBMED_LIMIT: 50,
        DEFAULT_CLINICAL_TRIALS_LIMIT: 50,
    },
    GEOGRAPHY: {
        TARGET_COUNTRIES: [
            { code: 'USA', name: 'United States' },
            { code: 'DEU', name: 'Germany' },
            { code: 'JPN', name: 'Japan' },
            { code: 'GBR', name: 'United Kingdom' }
        ],
        WHO_COUNTRY_MAP: {
            'USA': 'USA',
            'DEU': 'Germany',
            'JPN': 'Japan',
            'GBR': 'UK',
        }
    },
    UI: {
        DEFAULT_EXAMPLE_TERMS: [
            "SARS-CoV-2",
            "Mpox Virus",
            "Acinetobacter baumannii",
            "Mycobacterium tuberculosis"
        ],
        CHART_COLORS: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1']
    },
    RAG: {
        MAX_KNOWLEDGE_CHUNKS: 40,
        SIMILARITY_THRESHOLD: 0.7
    }
};

/**
 * GHO Indicator Mappings
 */
export const GHO_INDICATORS = {
    MAPPINGS: {
        'measles': 'WHS3_62',
        'cholera': 'WHS3_41',
        'yellow fever': 'WHS3_40',
        'polio': 'WHS3_52',
        'hepatitis b': 'WHS4_154',
        'malaria': 'MALARIA002',
        'acinetobacter': 'GLASS_AMR_ACINB_CARBA_RES',
        'klebsiella': 'GLASS_AMR_KLEPN_CARBA_RES',
        'e. coli': 'GLASS_AMR_ECOLI_3GC_RES',
        'infant': 'MDG_0000000001',
        'mortality': 'MDG_0000000001',
        'life expectancy': 'WHOSIS_000001',
    },
    LABELS: {
        'WHOSIS_000001': 'Life Expectancy at Birth',
        'WHS3_62': 'Measles - Number of reported cases',
        'WHS4_100': 'Measles-containing-vaccine second dose (MCV2) coverage (%)',
        'WHS4_117': 'DTP3 Immunization Coverage (%)',
        'WHS3_41': 'Cholera - Number of reported cases',
        'WHS3_40': 'Yellow Fever - Number of reported cases',
        'WHS3_52': 'Poliomyelitis - Number of reported cases',
        'WHS4_154': 'Hepatitis B (HepB3) immunization coverage among 1-year-olds (%)',
        'MALARIA002': 'Malaria - Number of reported cases',
        'MDG_0000000001': 'Infant Mortality Rate (per 1000 live births)',
        'GLASS_AMR_ACINB_CARBA_RES': 'Carbapenem-resistant Acinetobacter baumannii (%)',
        'GLASS_AMR_KLEPN_CARBA_RES': 'Carbapenem-resistant Klebsiella pneumoniae (%)',
        'GLASS_AMR_ECOLI_3GC_RES': '3rd gen cephalosporin-resistant E. coli (%)',
    }
};
