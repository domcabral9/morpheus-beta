import { Module } from "@nestjs/common";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { InventoryController } from "./inventory.controller";
import { InventoryRepository } from "./inventory.repository";
import { InventoryApprovalRepository } from "./inventory-approval.repository";
import { InventoryService } from "./inventory.service";
import { InventoryReviewScheduler } from "./inventory-review.scheduler";

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryRepository,
    InventoryApprovalRepository,
    InventoryService,
    InventoryReviewScheduler,
    SeparationOfDutiesService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
