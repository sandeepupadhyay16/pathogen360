# Medical 360: System Overview & Features

Medical 360 is a state-of-the-art intelligence platform designed for pharmaceutical researchers, clinicians, and medical analysts. It provides a "360-degree view" of medical research—covering pathogens, drugs, diseases, and molecules—by synthesizing data from scientific literature, clinical registries, and global health systems.

## Core Features

- **Semantic Medical Term Resolution**: An intelligent entry point that resolves natural language queries (e.g., "SARS2", "metformin", "Type 2 Diabetes") to canonical database entities using exact, regex, and vector-based matching.
- **Intelligent Knowledge Nucleus**: Synthesis of clinical trials, PubMed, and epidemiologic data.
- **Temporal Fidelity Intelligence**: A unique synthesis pathway that prioritizes recent literature (last 24 months) for high-detail reporting while condensing historical research to maintain a focused narrative.
- **Incremental Knowledge Merging**: Automatically integrates new findings from recent data ingestions into existing Knowledge Nuclei, ensuring reports evolve without losing historical context.
- **Multi-Modal Research Chat**: A RAG-powered (Retrieval-Augmented Generation) chat interface that intelligently routes queries between fast-cache responses and deep-dive semantic searches.
- **Interactive Research Intelligence**: On-demand deep-dive answering for investigative inquiries with global notification fabric.
- **Multi-Cluster Ingestion**: Dynamic search expansion and PMID-based deduplication for maximum research coverage.
- **Conversational RAG**: Context-constrained AI researcher for granular data retrieval.
- **High-Fidelity PDF Export**: Professional intelligence reports including core synthesis and deep-dive answers.
- **Automated Research Intelligence**: Generation of comprehensive PDF reports detailing development pipelines, clinical landscapes, and strategic insights.

## Technical Foundation

- **Framework**: Next.js 15 (App Router) for an interactive, responsive React-based frontend and robust API backend.
- **ORM & Database**: Prisma with PostgreSQL, utilizing the `pgvector` extension for semantic search and caching.
- **AI Integration**: Custom LLM orchestration for synthesis, intent routing, and natural language generation.
- **Data Pipeline**: Automated ingestion from PubMed (NCBI), ClinicalTrials.gov, WHO Global Health Observatory (GHO), and CDC MMWR.
