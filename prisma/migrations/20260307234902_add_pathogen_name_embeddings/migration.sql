-- CreateTable
CREATE TABLE "PathogenNameEmbedding" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isAlias" BOOLEAN NOT NULL DEFAULT false,
    "pathogenId" TEXT,
    "embedding" vector NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathogenNameEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PathogenNameEmbedding_name_key" ON "PathogenNameEmbedding"("name");

-- AddForeignKey
ALTER TABLE "PathogenNameEmbedding" ADD CONSTRAINT "PathogenNameEmbedding_pathogenId_fkey" FOREIGN KEY ("pathogenId") REFERENCES "Pathogen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
