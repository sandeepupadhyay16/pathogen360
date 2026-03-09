# Pathogen 360: Core Logic Pathways

This document details the primary algorithms and logic flows that power Pathogen 360's intelligence.

## 1. Pathogen Resolution Pathway
When a user searches for or asks about a pathogen, the system ensures it identifies the correct canonical entity.

1.  **Normalization**: Input is lowercased and trimmed.
2.  **In-memory Alias Match**: Quick check against `pathogen-aliases.json`.
3.  **Database Exact Match**: Case-insensitive search on the `Pathogen` table.
4.  **Regex Matching**: Applying fuzzy patterns (e.g., matching "MERS" to "Middle East Respiratory Syndrome").
5.  **Semantic Vector Match**: If the above fail, the query is embedded and searched against the `PathogenNameEmbedding` table using cosine similarity (`<=>`). This captures aliases like "the flu" mapping to "Influenza A virus".

## 2. Intent Routing Pathway
Every chat query passes through an "Intent Router" to determine the most accurate context to provide.

- **Routes**:
    - **Single Pathogen (UUID)**: Redirects to the specific dataset for that pathogen.
    - **Unrecognized**: Identified as in the registry but not yet onboarded; prompts user to initiate synthesis.
    - **Family**: Aggregates data for all pathogens in a specific family (e.g., "Coronaviridae").
    - **General/Cross-Pathogen**: Aggregates the entire database for high-level comparisons and trend spotting.
- **Mode Switching**: The router determines if the query requires a "Fast" (cached/nucleus only) or "Detailed" (deep RAG search) response.

## 3. Knowledge Synthesis Pathway
Synthesis is a heavy-duty process that transforms thousands of data points into a single intelligence report.

1.  **Ingestion**: Fetching articles (PubMed), trials (CT.gov), and metrics (WHO/CDC).
2.  **Temporal Fidelity Summarization**: 
    - `< 24mo`: High fidelity (detailed).
    - `24-60mo`: Balanced fidelity.
    - `> 60mo`: Aggressive fidelity (titles/PMIDs only).
3.  **Recursive Compression**: Grouping article summaries into batches (default 15) and synthesizing them into "Thematic Trends". If there are too many batches, the process recurses.
4.  **Final Consolidation**: The LLM merges clinical trends, trial pipelines, and epidemiology into a structured Markdown document.
5.  **Vectorization**: The final nucleus and individual summaries are chunked and stored as `KnowledgeChunk` records for future RAG queries.

## 4. Retrieval-Augmented Generation (RAG) Flow
1.  **Query Embedding**: User query is converted to a vector.
2.  **Vector Search**: Semantic search finds the top related `KnowledgeChunk` records for the target pathogen.
3.  **Context Construction**: The system assembles the Knowledge Nucleus + granular Chunks + hard Epidemiology Metrics.
4.  **LLM Inference**: The LLM generates a response strictly constrained by the assembled context, enforcing citation rules.
