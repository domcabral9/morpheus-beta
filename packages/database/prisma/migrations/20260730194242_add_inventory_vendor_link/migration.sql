-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "software_inventory_items_tenantId_vendorId_idx" ON "software_inventory_items"("tenantId", "vendorId");

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
