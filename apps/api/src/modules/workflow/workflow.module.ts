import { Module } from "@nestjs/common";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { TechnicalOpinionModule } from "../technical-opinions/technical-opinion.module";
import { WorkflowController } from "./workflow.controller";
import { WorkflowRepository } from "./workflow.repository";
import { WorkflowService } from "./workflow.service";

@Module({
  imports: [TechnicalOpinionModule],
  controllers: [WorkflowController],
  providers: [WorkflowRepository, WorkflowService, SeparationOfDutiesService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
