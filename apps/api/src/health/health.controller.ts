import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { Public } from "../common/decorators/public.decorator";
import { PrismaHealthIndicator } from "./prisma.health";

// Público: orquestradores (Docker/ECS) e load balancers checam isso sem JWT.
@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  /** Liveness: o processo está de pé. Não deve depender de recursos externos. */
  @Get("live")
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** Readiness: o processo está de pé E consegue falar com suas dependências (banco). */
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaIndicator.isHealthy("database")]);
  }
}
