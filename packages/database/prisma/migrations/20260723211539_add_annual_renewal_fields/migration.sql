-- AlterEnum
ALTER TYPE "AssessmentStatus" ADD VALUE 'PENDING_RENEWAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RENEWAL_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'RENEWAL_OVERDUE';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "renewalCycleStartedAt" TIMESTAMP(3),
ADD COLUMN     "renewalDueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "annualClosingWindowEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "annualClosingWindowEnd" TEXT,
ADD COLUMN     "annualClosingWindowStart" TEXT;

-- CreateIndex
CREATE INDEX "software_inventory_items_tenantId_areaId_status_idx" ON "software_inventory_items"("tenantId", "areaId", "status");
