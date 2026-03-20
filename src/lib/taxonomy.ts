/**
 * Unified taxonomy and classification utility for Medical360
 * This ensures consistent classification of medical terms into Biological, Pharmacological, Clinical, etc.
 */

export type MedicalTermType = 'BIOLOGICAL' | 'PHARMACOLOGICAL' | 'CLINICAL' | 'VIRAL' | 'BACTERIAL' | 'OTHER';

/**
 * Resolves the medical term category from a name or inferred category.
 * This is a foundational classifier.
 */
export const getMedicalTermType = (category: string | null): MedicalTermType => {
    if (!category) return 'OTHER';
    const c = category.toLowerCase();

    if (c.includes('drug') || c.includes('molecule') || c.includes('pharmacology')) {
        return 'PHARMACOLOGICAL';
    }

    if (c.includes('disease') || c.includes('condition') || c.includes('syndrome')) {
        return 'CLINICAL';
    }

    if (c.endsWith('viridae') || c.includes('virus')) {
        return 'VIRAL';
    }

    if (c.endsWith('aceae') || c.includes('bacteria') || c.includes('microbe')) {
        return 'BIOLOGICAL';
    }

    return 'OTHER';
};

/**
 * Returns a user-friendly label with emoji for a medical term type.
 */
export const getMedicalTermTypeLabel = (type: MedicalTermType): string => {
    switch (type) {
        case 'PHARMACOLOGICAL': return '💊 Pharmaceutical';
        case 'CLINICAL': return '🏥 Clinical';
        case 'VIRAL': return '🦠 Viral';
        case 'BIOLOGICAL': return '🧬 Biological';
        case 'BACTERIAL': return '🧫 Bacterial';
        default: return '🔍 Research';
    }
};
