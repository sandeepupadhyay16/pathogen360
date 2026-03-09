/**
 * Unified taxonomy utility for Pathogen360
 * This ensures consistent classification of pathogens into Viral, Bacterial, Fungal, and Parasitic types
 * based on their taxonomic family name.
 */

export type PathogenType = 'VIRAL' | 'BACTERIAL' | 'FUNGAL' | 'PARASITIC' | 'OTHER';

/**
 * Resolves the pathogen type from a family name.
 * Uses a combination of suffix matching and keyword detection.
 */
export const getPathogenType = (family: string | null): PathogenType => {
    if (!family) return 'OTHER';
    const f = family.toLowerCase();

    // 1. Viral Detection (Highest Priority)
    if (f.endsWith('viridae') || f.includes('virus')) {
        return 'VIRAL';
    }

    // 2. Fungal Detection
    // Matches specific families known to be fungal and general keywords
    const FUNGAL_FAMILIES = [
        'debaryomycetaceae', 'aspergillaceae', 'tremellaceae', 
        'ajellomycetaceae', 'onygenaceae', 'pneumocystidaceae',
        'fungi', 'mycete', 'saccharomycet'
    ];
    if (FUNGAL_FAMILIES.some(x => f.includes(x))) {
        return 'FUNGAL';
    }

    // 3. Parasitic Detection
    // Matches known protozoan and helminth families
    const PARASITE_KEYWORDS = [
        'plasmodiidae', 'sarcocystidae', 'trypanosomatidae', 
        'hexamitidae', 'entamoebidae', 'cryptosporidiidae', 
        'schistosomatidae', 'ascarididae', 'taeniidae', 'trichinellidae'
    ];
    if (PARASITE_KEYWORDS.some(x => f.includes(x))) {
        return 'PARASITIC';
    }

    // 4. Bacterial Detection
    // Matches 'aceae' suffix (standard for bacteria) and common bacterial keywords
    if (f.endsWith('aceae') || f.includes('bacteria') || f.includes('coccus') || f.includes('bacillus')) {
        return 'BACTERIAL';
    }

    return 'OTHER';
};

/**
 * Returns a user-friendly label with emoji for a pathogen type.
 */
export const getPathogenTypeLabel = (type: PathogenType): string => {
    switch (type) {
        case 'VIRAL': return '🦠 Viral';
        case 'BACTERIAL': return '🧫 Bacterial';
        case 'FUNGAL': return '🍄 Fungal';
        case 'PARASITIC': return '🪱 Parasitic';
        default: return '❓ Other';
    }
};
