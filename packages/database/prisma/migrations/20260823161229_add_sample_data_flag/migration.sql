-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "isSampleData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "isSampleData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "isSampleData" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "assessments_tenantId_isSampleData_idx" ON "assessments"("tenantId", "isSampleData");

-- CreateIndex
CREATE INDEX "software_inventory_items_tenantId_isSampleData_idx" ON "software_inventory_items"("tenantId", "isSampleData");

-- CreateIndex
CREATE INDEX "vendors_tenantId_isSampleData_idx" ON "vendors"("tenantId", "isSampleData");
