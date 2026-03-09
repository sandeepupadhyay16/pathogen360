# Pathogen 360

Pathogen 360 is an advanced research and analysis platform designed to synthesize information about pathogens, their epidemiology, vaccines, and market potential. It leverages LLMs and RAG (Retrieval-Augmented Generation) to provide deep insights from scientific literature and public health databases.

## Features

- **Global Pathogen Search**: Query a vast database of pathogens and receive detailed, structured information.
- **Deep Research Mode**: Utilizes advanced LLM capabilities for thorough literature review and synthesis.
- **Automated Report Generation**: Generate comprehensive PDF reports for specific pathogens.
- **Data Ingestion Pipeline**: Onboard new pathogens by fetching data from PubMed, CDC, and WHO.
- **Admin Dashboard**: Manage the pathogen registry, monitor system performance, and backfill data.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Styling**: Tailwind CSS
- **AI/LLM**: Integration with custom LLM endpoints for synthesis and chat
- **Data Sources**: PubMed, CDC, WHO, ClinicalTrials.gov

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- LLM API key/endpoint access

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Creating a `.env` file based on the project requirements (ensure `DATABASE_URL`, `LLM_API_KEY`, etc. are set).
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Project Structure

- `src/app`: Next.js pages and API routes
- `src/components`: Reusable UI components
- `src/lib`: Core logic, utilities, and external API integrations
- `scripts`: Maintenance and data ingestion scripts
- `prisma`: Database schema and migrations

## License

All rights reserved.
