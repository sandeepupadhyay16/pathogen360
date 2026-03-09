# Pathogen 360: Data Schema & Integrations

Pathogen 360 relies on a relational and vector network of data to provide comprehensive insights.

## Database Schema (Prisma)

### Primary Models
- **Pathogen**: The central entity (Name, Taxonomy, Biology, synthesizedContext).
- **Article**: Metadata and abstracts fetched from PubMed.
- **ClinicalTrial**: Detailed trial data from ClinicalTrials.gov (Phase, Status, Sponsor, etc.).
- **EpidemiologyMetric**: Structured data from WHO (Indicator, Value, Location, Year).
- **SurveillanceAlert**: Outbreak reports and alerts from CDC.

### Intelligence & Vector Models
- **KnowledgeChunk**: Short segments of text with associated vector embeddings for semantic RAG search.
- **PathogenNameEmbedding**: Vector embeddings for pathogen names and aliases to support semantic resolution.
- **SemanticCache**: Previously generated AI responses indexed by query vector for fast retrieval.

### Operations & Tracing
- **Operation / OperationLog**: Tracks long-running background tasks like synthesis, providing progress updates and error logs.
- **Conversation / Message**: Stores chat history, including reasoning models and token usage diagnostics.

## External Integrations

### 1. PubMed (NCBI)
- **Purpose**: Scientific literature foundation.
- **Flow**: Fetches PMIDs via search criteria -> Fetches XML abstracts -> Summarized by LLM.

### 2. ClinicalTrials.gov
- **Purpose**: Monitoring the development pipeline.
- **Flow**: Fetches NCT IDs -> Detailed trial protocols -> Extracts intervention types (e.g., Vaccines).

### 3. WHO Global Health Observatory (GHO)
- **Purpose**: Hard epidemiological metrics.
- **Flow**: Direct API calls for specific disease indicators (incidence, mortality, immunization coverage).

### 4. CDC MMWR
- **Purpose**: Real-time surveillance updates.
- **Flow**: Scrapes/Fetches recent alerts and outbreak reports to provide up-to-the-minute awareness.
