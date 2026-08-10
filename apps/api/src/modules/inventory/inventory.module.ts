import { Module } from "@nestjs/common";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { PlatformPolicyModule } from "../platform-policy/platform-policy.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { StorageModule } from "../storage/storage.module";
import { InventoryController } from "./inventory.controller";
import { InventoryRepository } from "./inventory.repository";
import { InventoryApprovalRepository } from "./inventory-approval.repository";
import { InventoryService } from "./inventory.service";
import { InventoryReviewScheduler } from "./inventory-review.scheduler";
import { EolCatalogClient } from "./eol/eol-catalog.client";
import { EolCatalogRepository } from "./eol/eol-catalog.repository";
import { EolCatalogScheduler } from "./eol/eol-catalog.scheduler";
import { VirusTotalClient } from "./reputation/virustotal.client";
import { ReputationBudgetRepository } from "./reputation/reputation-budget.repository";
import { ReputationService } from "./reputation/reputation.service";
import { ReputationSweepScheduler } from "./reputation/reputation-sweep.scheduler";
import { ExposureHostResolver } from "./exposure/exposure-host-resolver";
import { InternetDbClient } from "./exposure/internetdb.client";
import { ExposureService } from "./exposure/exposure.service";
import { ExposureSweepScheduler } from "./exposure/exposure-sweep.scheduler";

@Module({
  imports: [PlatformPolicyModule, AttachmentsModule, StorageModule],
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
    VirusTotalClient,
    ReputationBudgetRepository,
    ReputationService,
    ReputationSweepScheduler,
    ExposureHostResolver,
    InternetDbClient,
    ExposureService,
    ExposureSweepScheduler,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
