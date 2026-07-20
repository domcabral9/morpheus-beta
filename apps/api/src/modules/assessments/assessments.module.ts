import { Module } from "@nestjs/common";
import { AreasModule } from "../areas/areas.module";
import { UsersModule } from "../users/users.module";
import { QuestionnaireModule } from "../questionnaire/questionnaire.module";
import { RiskEngineModule } from "../risk-engine/risk-engine.module";
import { AssessmentsController } from "./assessments.controller";
import { AssessmentsRepository } from "./assessments.repository";
import { AssessmentsService } from "./assessments.service";

@Module({
  imports: [AreasModule, UsersModule, QuestionnaireModule, RiskEngineModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsRepository, AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
