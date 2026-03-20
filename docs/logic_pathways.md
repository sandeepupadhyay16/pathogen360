# Medical 360: Core Logic Pathways

This document details the primary algorithms and logic flows that power Medical 360's intelligence.

## 1. Medical Term Resolution Pathway

When a user searches for or asks about a medical term (pathogen, drug, disease, molecule), the system ensures it identifies the correct canonical entity.

1. **Normalization**: Input is lowercased and trimmed.
2. **In-memory Alias Match**: Quick check against term-specific alias registries.
3. **Database Exact Match**: Case-insensitive search on the `MedicalTerm` table.
4. **Regex Matching**: Applying fuzzy patterns (e.g., matching "MERS" to "Middle East Respiratory Syndrome").
5. **Semantic Vector Match**: If the above fail, the query is embedded and searched against the `MedicalTermEmbedding` table using cosine similarity (`<=>`). This captures aliases like "the flu" mapping to "Influenza A virus".

## 2. Intent Routing Pathway

Every chat query passes through an "Intent Router" to determine the most accurate context to provide.

- **Routes**:
  - **Single Medical Term (UUID)**: Redirects to the specific dataset for that term.
  - **Unrecognized**: Identified as in the registry but not yet onboarded; prompts user to initiate synthesis.
  - **Family/Category**: Aggregates data for all terms in a specific category (e.g., "Coronaviridae" or "Monoclonal Antibodies").
  - **General/Cross-Term**: Aggregates the entire database for high-level comparisons and trend spotting.
- **Mode Switching**: The router determines if the query requires a "Fast" (cached/nucleus only) or "Detailed" (deep RAG search) response.

## 3. Knowledge Synthesis Pathway

Synthesis is a heavy-duty process that transforms thousands of data points into a single intelligence report (the Knowledge Nucleus).

1. **Logical Inquiry Generation**: Prior to search, the LLM identifies up to 25 core investigative questions.
2. **Multi-Cluster Search Strategy**: The system generates unique keyword clusters for the original term + question-based keywords.
3. **PMID-Based Deduplication**: Since clusters often overlap, the system uses the unique PubMed ID (PMID) or ClinicalTrials.gov ID (NCT number) to filter out redundant records.
4. **Compression (Overlap) Metric**: Calculated as `(Total Raw Found - Unique Items) / Total Raw Found`. This metric indicates search efficiency and coverage density.
5. **Data Persistence**: Fetching articles (PubMed), trials (CT.gov), and metrics (WHO/CDC) into the relational database.
6. **Temporal Fidelity Summarization**:
   - `< 24mo`: High fidelity (detailed).
   - `24-60mo`: Balanced fidelity.
   - `> 60mo`: Aggressive fidelity (titles/PMIDs only).
7. **Incremental Narrative Merging**: If an existing Nucleus exists, the system performs a "Narrative Merge" rather than a full overwrite. It integrates new findings from recent ingestion into the existing structure, preserving historical context while highlighting advancements.
8. **Recursive Compression**: Grouping article summaries into batches (default 15) and synthesizing them into "Thematic Trends". If there are too many batches, the process recurses.
9. **Final Consolidation (High Capacity)**: The LLM merges clinical trends, trial pipelines, and research gaps into a structured Markdown document. The system uses a high-capacity context (15,000 tokens) to ensure deep coverage of the literature.
10. **Inquiry Ready State**: Post-nucleus generation, the system prepares the 25 logical questions as interactive placeholders.
11. **Vectorization**: The final nucleus and individual summaries are chunked and stored as `KnowledgeChunk` records for future RAG queries.

## 4. Logical Inquiry Deep Dives (On-Demand)

Unlike the core synthesis, deep-dive answers for logical questions are generated asynchronously to maintain UI responsiveness:

1. **Trigger**: User clicks a "Research Inquiry" chip in the Knowledge Nucleus view.
2. **Async Operation**: A background `Operation` of type `ANSWER_QUESTION` is registered.
3. **Intelligence Retrieval**: The LLM is provided with the full **Knowledge Nucleus** as its primary source of truth (context).
4. **Specialized Prompting**: The engine uses a "Researcher persona" to answer the specific inquiry, ensuring zero hallucination by strictly adhering to the Nucleus content.
5. **Persistence & Cache**: The answer is saved back to the `LogicalQuestion` record.
6. **Global Alert**: The **Notification Fabric** detects the completed operation and alerts the user with a direct link to the new intelligence.
7. **Auto-Inclusion**: All answered inquiries are automatically merged into the High Fidelity Research Report (PDF) generation flow.

## 5. Retrieval-Augmented Generation (RAG) Flow

1. **Query Embedding**: User query is converted to a vector.
2. **Vector Search**: Semantic search finds the top related `KnowledgeChunk` records for the target medical term.
3. **Context Construction**: The system assembles the Knowledge Nucleus + granular Chunks + hard metrics/alerts.
4. **LLM Inference**: The LLM generates a response strictly constrained by the assembled context, enforcing citation rules.
