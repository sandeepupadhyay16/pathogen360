-- CreateTable
CREATE TABLE "Pathogen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxonomy" TEXT,
    "biology" TEXT,
    "family" TEXT,
    "synthesizedContext" TEXT,
    "synthesisUpdatedAt" TIMESTAMP(3),
    "synthesisArticleCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pathogen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "pubmedId" TEXT NOT NULL,
    "pmcId" TEXT,
    "hasFullText" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "abstractText" TEXT,
    "authors" TEXT,
    "publicationDate" TIMESTAMP(3),
    "countryAffiliations" TEXT,
    "pathogenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketReport" (
    "id" TEXT NOT NULL,
    "pathogenId" TEXT NOT NULL,
    "epidemiology" TEXT,
    "populationSize" TEXT,
    "marketPotential" TEXT,
    "investmentGaps" TEXT,
    "vaccineLandscape" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalTrial" (
    "id" TEXT NOT NULL,
    "nctId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" TEXT,
    "status" TEXT,
    "overallStatus" TEXT,
    "interventionType" TEXT,
    "isVaccine" BOOLEAN NOT NULL DEFAULT false,
    "sponsor" TEXT,
    "collaborators" TEXT,
    "conditions" TEXT,
    "locations" TEXT,
    "description" TEXT,
    "eligibilityCriteria" TEXT,
    "enrollment" INTEGER,
    "studyDesign" TEXT,
    "primaryOutcomes" TEXT,
    "secondaryOutcomes" TEXT,
    "interventionDetails" TEXT,
    "resultsPosted" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "primaryCompletionDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "pathogenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalTrial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pathogen_name_key" ON "Pathogen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Article_pubmedId_key" ON "Article"("pubmedId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalTrial_nctId_key" ON "ClinicalTrial"("nctId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_pathogenId_fkey" FOREIGN KEY ("pathogenId") REFERENCES "Pathogen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketReport" ADD CONSTRAINT "MarketReport_pathogenId_fkey" FOREIGN KEY ("pathogenId") REFERENCES "Pathogen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalTrial" ADD CONSTRAINT "ClinicalTrial_pathogenId_fkey" FOREIGN KEY ("pathogenId") REFERENCES "Pathogen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
