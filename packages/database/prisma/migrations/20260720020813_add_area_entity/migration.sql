/*
  Warnings:

  - You are about to drop the column `requestingArea` on the `assessments` table. All the data in the column will be lost.
  - You are about to drop the column `requestingArea` on the `software_inventory_items` table. All the data in the column will be lost.
  - Added the required column `areaId` to the `assessments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `areaId` to the `software_inventory_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "assessments" DROP COLUMN "requestingArea",
ADD COLUMN     "areaId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "software_inventory_items" DROP COLUMN "requestingArea",
ADD COLUMN     "areaId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "areas_tenantId_idx" ON "areas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_tenantId_name_key" ON "areas"("tenantId", "name");

-- CreateIndex
CREATE INDEX "assessments_tenantId_areaId_idx" ON "assessments"("tenantId", "areaId");

-- CreateIndex
CREATE INDEX "software_inventory_items_tenantId_areaId_idx" ON "software_inventory_items"("tenantId", "areaId");

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
