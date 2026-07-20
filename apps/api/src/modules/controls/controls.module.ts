import { Module } from "@nestjs/common";
import { ControlsController } from "./controls.controller";
import { ControlsRepository } from "./controls.repository";
import { ControlsService } from "./controls.service";

@Module({
  controllers: [ControlsController],
  providers: [ControlsRepository, ControlsService],
  exports: [ControlsService],
})
export class ControlsModule {}
