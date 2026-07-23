-- CreateTable
CREATE TABLE "inventory_documentation_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_documentation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_documentation_links_tenantId_idx" ON "inventory_documentation_links"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_documentation_links_inventoryItemId_idx" ON "inventory_documentation_links"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "inventory_documentation_links" ADD CONSTRAINT "inventory_documentation_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documentation_links" ADD CONSTRAINT "inventory_documentation_links_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "software_inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
