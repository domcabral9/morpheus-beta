-- AlterEnum
ALTER TYPE "SoftwareType" ADD VALUE 'API_INTEGRATION';

-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "hostingProvider" TEXT;
