const pathogens = [
    // Viral - Respiratory & Emerging
    "SARS-CoV-2", "MERS-CoV", "SARS-CoV", "Influenza A Virus H5N1", "Influenza A Virus H1N1", "Influenza B Virus",
    "Respiratory Syncytial Virus", "Rhinovirus", "Adenovirus", "Parainfluenza Virus",
    // Viral - Hemorrhagic & Zoonotic
    "Ebola Virus", "Marburg Virus", "Lassa Virus", "Nipah Virus", "Hendra Virus", "Machupo Virus", "Junin Virus",
    "Crimean-Congo Haemorrhagic Fever Virus", "Rift Valley Fever Virus", "Hantavirus", "Yellow Fever Virus",
    "Zika Virus", "Dengue Virus", "West Nile Virus", "Chikungunya Virus", "Japanese Encephalitis Virus",
    // Viral - Others
    "HIV-1", "HIV-2", "Hepatitis A Virus", "Hepatitis B Virus", "Hepatitis C Virus", "Hepatitis D Virus", "Hepatitis E Virus",
    "Epstein-Barr Virus", "Cytomegalovirus", "Herpes Simplex Virus 1", "Herpes Simplex Virus 2", "Varicella Zoster Virus",
    "Mpox Virus", "Rabies Virus", "Poliovirus", "Norovirus", "Rotavirus", "HPV", "Rubella Virus", "Measles Virus", "Mumps Virus",
    // Bacterial - Priority & Biothreat
    "Bacillus anthracis", "Yersinia pestis", "Francisella tularensis", "Brucella melitensis", "Coxiella burnetii",
    "Burkholderia pseudomallei", "Burkholderia mallei",
    // Bacterial - Respiratory
    "Mycobacterium tuberculosis", "Mycobacterium leprae", "Streptococcus pneumoniae", "Haemophilus influenzae",
    "Legionella pneumophila", "Bordetella pertussis", "Corynebacterium diphtheriae", "Mycoplasma pneumoniae",
    // Bacterial - Gastrointestinal
    "Vibrio cholerae", "Salmonella Typhi", "Salmonella Enteritidis", "Shigella dysenteriae", "Campylobacter jejuni",
    "Listeria monocytogenes", "Helicobacter pylori", "Clostridioides difficile", "Escherichia coli O157:H7",
    // Bacterial - Others
    "Staphylococcus aureus", "Streptococcus pyogenes", "Neisseria gonorrhoeae", "Neisseria meningitidis",
    "Chlamydia trachomatis", "Treponema pallidum", "Borrelia burgdorferi", "Leptospira interrogans",
    "Clostridium tetani", "Clostridium botulinum", "Pseudomonas aeruginosa", "Acinetobacter baumannii",
    "Klebsiella pneumoniae", "Enterococcus faecalis",
    // Parasitic
    "Plasmodium falciparum", "Plasmodium vivax", "Toxoplasma gondii", "Trypanosoma cruzi", "Trypanosoma brucei",
    "Leishmania donovani", "Giardia lamblia", "Entamoeba histolytica", "Cryptosporidium parvum", "Schistosoma mansoni",
    "Ascaris lumbricoides", "Taenia solium", "Echinococcus granulosus", "Trichinella spiralis",
    // Fungal
    "Candida albicans", "Candida auris", "Aspergillus fumigatus", "Cryptococcus neoformans", "Histoplasma capsulatum",
    "Coccidioides immitis", "Pneumocystis jirovecii"
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ingestPathogen(name, attempt = 1) {
    console.log(`[Attempt ${attempt}] Starting ingestion for: ${name}`);
    try {
        const response = await fetch('http://localhost:3000/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pathogenName: name, maxResults: 15 }) // Reduced slightly to avoid long URIs
        });

        if (response.status === 429) {
            console.warn(`Rate limit hit for ${name}. Sleeping 5s...`);
            await sleep(5000);
            if (attempt < 3) return ingestPathogen(name, attempt + 1);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // Optionally parse logs to check for "Too Many Requests" inside the stream
            const text = new TextDecoder().decode(value);
            if (text.includes("Too Many Requests") || text.includes("Request-URI Too Long")) {
                console.warn(`Error detected in stream for ${name}: ${text}`);
                // Unfortunately we can't easily restart once streaming has begun and failed partially
            }
        }

        console.log(`Successfully finished request for: ${name}`);
    } catch (error) {
        console.error(`Failed to ingest ${name}:`, error.message);
        if (attempt < 3 && (error.message.includes("429") || error.message.includes("Too Many Requests"))) {
            await sleep(5000 * attempt);
            return ingestPathogen(name, attempt + 1);
        }
    }
}

async function main() {
    console.log(`Hydrating system with ${pathogens.length} pathogens... (Robust Mode)`);

    // Concurrency of 1 to be gentle on PubMed and avoid rate limits
    for (const pathogen of pathogens) {
        await ingestPathogen(pathogen);
        await sleep(2000); // 2s gap between pathogens
    }

    console.log("Hydration complete!");
}

main();
