import { Module } from "@nestjs/common";
import { ControlsModule } from "../controls/controls.module";
import { QuestionnaireController } from "./questionnaire.controller";
import { QuestionnaireRepository } from "./questionnaire.repository";
import { QuestionnaireService } from "./questionnaire.service";

@Module({
  imports: [ControlsModule],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireRepository, QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
