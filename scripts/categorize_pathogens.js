const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function log(msg) {
    console.log(msg);
    fs.appendFileSync('/tmp/cat.log', msg + '\n');
}

const pathogenFamilies = {
    // Viral families
    'rubella': 'Matonaviridae',
    'hepatitis a': 'Picornaviridae',
    'hepatitis d': 'Kolmioviridae',
    'hepatitis e': 'Hepeviridae',
    'haemophilus': 'Pasteurellaceae',
    'sars-cov-2': 'Coronaviridae',
    'mers-cov': 'Coronaviridae',
    'sars-cov': 'Coronaviridae',
    'influenza': 'Orthomyxoviridae',
    'hiv': 'Retroviridae',
    'rsv': 'Pneumoviridae',
    'respiratory syncytial': 'Pneumoviridae',
    'rhinovirus': 'Picornaviridae',
    'adenovirus': 'Adenoviridae',
    'parainfluenza': 'Paramyxoviridae',
    'zika': 'Flaviviridae',
    'dengue': 'Flaviviridae',
    'west nile': 'Flaviviridae',
    'hep c': 'Flaviviridae',
    'hepatitis c': 'Flaviviridae',
    'hep b': 'Hepadnaviridae',
    'hepatitis b': 'Hepadnaviridae',
    'yellow fever': 'Flaviviridae',
    'japanese encephalitis': 'Flaviviridae',
    'ebola': 'Filoviridae',
    'marburg': 'Filoviridae',
    'chikungunya': 'Togaviridae',
    'nipah': 'Paramyxoviridae',
    'hendra': 'Paramyxoviridae',
    'measles': 'Paramyxoviridae',
    'mumps': 'Paramyxoviridae',
    'epstein-barr': 'Herpesviridae',
    'cytomegalovirus': 'Herpesviridae',
    'herpes simplex': 'Herpesviridae',
    'varicella': 'Herpesviridae',
    'lassa': 'Arenaviridae',
    'machupo': 'Arenaviridae',
    'junin': 'Arenaviridae',
    'hantavirus': 'Hantaviridae',
    'cchf': 'Nairoviridae',
    'crimean-congo': 'Nairoviridae',
    'rift valley': 'Phenuiviridae',
    'polio': 'Picornaviridae',
    'norovirus': 'Caliciviridae',
    'rotavirus': 'Reoviridae',
    'hpv': 'Papillomaviridae',
    'mpox': 'Poxviridae',
    'monkeypox': 'Poxviridae',
    'smallpox': 'Poxviridae',
    'rabies': 'Rhabdoviridae',

    // Bacterial families
    'anthrax': 'Bacillaceae',
    'bacillus anthracis': 'Bacillaceae',
    'plague': 'Yersiniaceae',
    'yersinia pestis': 'Yersiniaceae',
    'francisella': 'Francisellaceae',
    'tularemia': 'Francisellaceae',
    'brucella': 'Brucellaceae',
    'coxiella': 'Coxiellaceae',
    'burkholderia': 'Burkholderiaceae',
    'tuberculosis': 'Mycobacteriaceae',
    'mycobacterium': 'Mycobacteriaceae',
    'streptococcus': 'Streptococcaceae',
    'pneumococcus': 'Streptococcaceae',
    'staphylococcus': 'Staphylococcaceae',
    'mrsa': 'Staphylococcaceae',
    'haemophilus': 'Pasteurellaceae',
    'legionella': 'Legionellaceae',
    'pertussis': 'Alcaligenaceae',
    'bordetella': 'Alcaligenaceae',
    'diphtheria': 'Corynebacteriaceae',
    'mycoplasma': 'Mycoplasmataceae',
    'cholera': 'Vibrionaceae',
    'vibrio': 'Vibrionaceae',
    'salmonella': 'Enterobacteriaceae',
    'typhoid': 'Enterobacteriaceae',
    'shigella': 'Enterobacteriaceae',
    'campylobacter': 'Campylobacteraceae',
    'listeria': 'Listeriaceae',
    'helicobacter': 'Helicobacteraceae',
    'clostridium': 'Clostridiaceae',
    'tetanus': 'Clostridiaceae',
    'botulinum': 'Clostridiaceae',
    'clostridioides': 'Peptostreptococcaceae',
    'difficile': 'Peptostreptococcaceae',
    'escherichia': 'Enterobacteriaceae',
    'shiga': 'Enterobacteriaceae',
    'gonorrhea': 'Neisseriaceae',
    'neisseria': 'Neisseriaceae',
    'meningococcus': 'Neisseriaceae',
    'chlamydia': 'Chlamydiaceae',
    'treponema': 'Spirochaetaceae',
    'syphilis': 'Spirochaetaceae',
    'borrelia': 'Borreliaceae',
    'lyme': 'Borreliaceae',
    'leptospira': 'Leptospiraceae',
    'pseudomonas': 'Pseudomonadaceae',
    'acinetobacter': 'Moraxellaceae',
    'klebsiella': 'Enterobacteriaceae',
    'enterococcus': 'Enterococcaceae',

    // Parasitic families
    'malaria': 'Plasmodiidae',
    'plasmodium': 'Plasmodiidae',
    'toxoplasma': 'Sarcocystidae',
    'trypanosoma': 'Trypanosomatidae',
    'leishmania': 'Trypanosomatidae',
    'giardia': 'Hexamitidae',
    'entamoeba': 'Entamoebidae',
    'cryptosporidium': 'Cryptosporidiidae',
    'schistosoma': 'Schistosomatidae',
    'ascaris': 'Ascarididae',
    'taenia': 'Taeniidae',
    'echinococcus': 'Taeniidae',
    'trichinella': 'Trichinellidae',

    // Fungal families
    'candida': 'Debaryomycetaceae',
    'aspergillus': 'Aspergillaceae',
    'cryptococcus': 'Tremellaceae',
    'histoplasma': 'Ajellomycetaceae',
    'coccidioides': 'Onygenaceae',
    'pneumocystis': 'Pneumocystidaceae'
};

async function main() {
    log('Starting refined pathogen categorization...');
    const pathogens = await prisma.pathogen.findMany();

    for (const pathogen of pathogens) {
        const nameLower = pathogen.name.toLowerCase();
        let family = 'Unknown';

        for (const [key, val] of Object.entries(pathogenFamilies)) {
            if (nameLower.includes(key)) {
                family = val;
                break;
            }
        }

        await prisma.pathogen.update({
            where: { id: pathogen.id },
            data: { family: family.toUpperCase() }
        });
        log(`Updated ${pathogen.name} -> ${family}`);
    }

    log('Categorization complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
