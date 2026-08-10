-- AlterTable
ALTER TABLE "platform_integrations_policies" ADD COLUMN     "internetDbEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "exposureCheckedIp" TEXT,
ADD COLUMN     "exposureLastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "exposureRawData" JSONB;

-- CreateIndex
CREATE INDEX "software_inventory_items_exposureLastCheckedAt_idx" ON "software_inventory_items"("exposureLastCheckedAt");
