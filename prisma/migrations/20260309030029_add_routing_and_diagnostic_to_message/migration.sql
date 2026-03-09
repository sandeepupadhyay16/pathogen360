-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "diagnostic" JSONB,
ADD COLUMN     "routingPath" JSONB;
