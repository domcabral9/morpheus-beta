-- CreateEnum
CREATE TYPE "ReputationVerdict" AS ENUM ('CLEAN', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "ReputationCheckSource" AS ENUM ('URL', 'ATTACHMENT_HASH');

-- AlterTable
ALTER TABLE "software_inventory_items" ADD COLUMN     "eolLinkedAt" TIMESTAMP(3),
ADD COLUMN     "eolLinkedByUserId" TEXT,
ADD COLUMN     "eolProductId" TEXT,
ADD COLUMN     "reputationCheckedAttachmentId" TEXT,
ADD COLUMN     "reputationCheckedSource" "ReputationCheckSource",
ADD COLUMN     "reputationDeclaredKnown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reputationLastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "reputationVerdict" "ReputationVerdict";

-- CreateTable
CREATE TABLE "platform_integrations_policies" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "virusTotalApiKeyEncrypted" TEXT,
    "virusTotalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "virusTotalDailyBudget" INTEGER NOT NULL DEFAULT 450,
    "endoflifeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_integrations_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_daily_budgets" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "virusTotalCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrichment_daily_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eol_products" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycles" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eol_products_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrichment_daily_budgets_date_key" ON "enrichment_daily_budgets"("date");

-- CreateIndex
CREATE INDEX "software_inventory_items_reputationLastCheckedAt_idx" ON "software_inventory_items"("reputationLastCheckedAt");

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_eolProductId_fkey" FOREIGN KEY ("eolProductId") REFERENCES "eol_products"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
