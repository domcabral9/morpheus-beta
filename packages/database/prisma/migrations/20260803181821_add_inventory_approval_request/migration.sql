-- CreateEnum
CREATE TYPE "InventoryApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "InventoryStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_APPROVAL_REQUESTED';

-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "inventory_approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "InventoryApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_approval_requests_inventoryItemId_key" ON "inventory_approval_requests"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_approval_requests_tenantId_idx" ON "inventory_approval_requests"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_approval_requests_tenantId_status_idx" ON "inventory_approval_requests"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_approval_requests" ADD CONSTRAINT "inventory_approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_approval_requests" ADD CONSTRAINT "inventory_approval_requests_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "software_inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_approval_requests" ADD CONSTRAINT "inventory_approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_approval_requests" ADD CONSTRAINT "inventory_approval_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
