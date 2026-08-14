-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RENEWAL_PENDING_REQUESTER_INACTIVE';
ALTER TYPE "NotificationType" ADD VALUE 'RENEWAL_REQUESTER_REASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_REASSESSMENT_DUE_PERFORMER_INACTIVE';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_ITEM_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_ITEM_REJECTED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "data" JSONB,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "body" DROP NOT NULL;
