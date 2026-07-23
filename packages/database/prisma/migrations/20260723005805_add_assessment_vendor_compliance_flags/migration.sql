-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "hasInfoSecClause" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasRiskAnalysis" BOOLEAN NOT NULL DEFAULT false;
