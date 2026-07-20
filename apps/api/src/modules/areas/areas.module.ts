import { Module } from "@nestjs/common";
import { AreasController } from "./areas.controller";
import { AreasRepository } from "./areas.repository";
import { AreasService } from "./areas.service";

@Module({
  controllers: [AreasController],
  providers: [AreasRepository, AreasService],
  exports: [AreasService],
})
export class AreasModule {}
