import { Module } from "@nestjs/common";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { PlatformPolicyModule } from "../platform-policy/platform-policy.module";
import { InventoryController } from "./inventory.controller";
import { InventoryRepository } from "./inventory.repository";
import { InventoryApprovalRepository } from "./inventory-approval.repository";
import { InventoryService } from "./inventory.service";
import { InventoryReviewScheduler } from "./inventory-review.scheduler";
import { EolCatalogClient } from "./eol/eol-catalog.client";
import { EolCatalogRepository } from "./eol/eol-catalog.repository";
import { EolCatalogScheduler } from "./eol/eol-catalog.scheduler";

@Module({
  imports: [PlatformPolicyModule],
  controllers: [InventoryController],
  providers: [
    InventoryRepository,
    InventoryApprovalRepository,
    InventoryService,
    InventoryReviewScheduler,
    SeparationOfDutiesService,
    EolCatalogClient,
    EolCatalogRepository,
    EolCatalogScheduler,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
