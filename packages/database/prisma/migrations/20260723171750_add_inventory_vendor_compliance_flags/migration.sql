-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "hasInfoSecClause" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasRiskAnalysis" BOOLEAN NOT NULL DEFAULT false;
