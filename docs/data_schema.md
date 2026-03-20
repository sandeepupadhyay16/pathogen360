# Medical 360: Data Schema & Integrations

Medical 360 relies on a relational and vector network of data to provide comprehensive insights.

## Database Schema (Prisma)

### Primary Models

- **MedicalTerm**: The central entity (Name, Category, Biology, description, synthesizedContext, synthesisUpdatedAt).
- **Article**: Metadata and abstracts fetched from PubMed (pubmedId, pmcId, title, abstractText, publicationDate).
- **ClinicalTrial**: Detailed trial data from ClinicalTrials.gov (nctId, phase, status, overallStatus, interventionType, sponsor, startDate, etc.).
- **MedicalMetric**: Structured data from WHO (indicator, value, unit, year, location).
- **SurveillanceAlert**: Outbreak reports and alerts from CDC (title, source, publishedAt, severity).

### Intelligence & Vector Models

- **KnowledgeChunk**: Short segments of text with associated vector embeddings for semantic RAG search.
- **MedicalTermEmbedding**: Vector embeddings for medical term names and aliases to support semantic resolution.
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
- **Flow**: Fetches NCT IDs -> Detailed trial protocols -> Extracts intervention types and key outcomes.

### 3. WHO Global Health Observatory (GHO)

- **Purpose**: Hard epidemiological metrics.
- **Flow**: Direct API calls for specific disease/medical indicators (incidence, mortality, immunization coverage).

### 4. CDC MMWR

- **Purpose**: Real-time surveillance updates.
- **Flow**: Scrapes/Fetches recent alerts and outbreak reports to provide up-to-the-minute awareness.
