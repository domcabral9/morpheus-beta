import { Module } from "@nestjs/common";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsRepository } from "./dashboards.repository";
import { DashboardsService } from "./dashboards.service";

@Module({
  controllers: [DashboardsController],
  providers: [DashboardsRepository, DashboardsService],
})
export class DashboardsModule {}
