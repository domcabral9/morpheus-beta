import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryRepository } from "./inventory.repository";
import { InventoryService } from "./inventory.service";
import { InventoryReviewScheduler } from "./inventory-review.scheduler";

@Module({
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService, InventoryReviewScheduler],
  exports: [InventoryService],
})
export class InventoryModule {}
