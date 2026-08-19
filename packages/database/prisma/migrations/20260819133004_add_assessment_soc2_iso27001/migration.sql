-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "hasIso27001Certificate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasSoc2Report" BOOLEAN NOT NULL DEFAULT false;
