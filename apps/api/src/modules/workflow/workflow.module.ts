import { Module } from "@nestjs/common";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { WorkflowController } from "./workflow.controller";
import { WorkflowRepository } from "./workflow.repository";
import { WorkflowService } from "./workflow.service";

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowRepository, WorkflowService, SeparationOfDutiesService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
