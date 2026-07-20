import { join } from "node:path";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { LoggerModule } from "nestjs-pino";
import type { Options as PinoHttpOptions } from "pino-http";
import { validateEnv } from "./config/env.validation";
import { CORRELATION_ID_HEADER } from "./common/middleware/correlation-id.middleware";
import { MetricsController } from "./common/controllers/metrics.controller";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AreasModule } from "./modules/areas/areas.module";
import { QuestionnaireModule } from "./modules/questionnaire/questionnaire.module";
import { AssessmentsModule } from "./modules/assessments/assessments.module";
import { RiskMatrixModule } from "./modules/risk-matrix/risk-matrix.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";

const pinoHttpOptions: PinoHttpOptions = {
  genReqId: (req) => req.headers[CORRELATION_ID_HEADER] as string,
  customProps: (req) => ({ correlationId: req.headers[CORRELATION_ID_HEADER] }),
  redact: ["req.headers.authorization", "req.headers.cookie"],
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { singleLine: true } }
      : undefined,
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Em dev, `nest start` roda com cwd = apps/api; a raiz do monorepo tem
      // o único .env real. Em produção (Docker), os envs vêm do compose e
      // este arquivo simplesmente não existe — ConfigModule ignora e usa
      // process.env normalmente.
      envFilePath: join(__dirname, "..", "..", "..", ".env"),
    }),
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: "metrics",
      controller: MetricsController,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AreasModule,
    QuestionnaireModule,
    AssessmentsModule,
    RiskMatrixModule,
    WorkflowModule,
  ],
  providers: [
    // Protegido por padrão em toda a aplicação — rotas ficam públicas só com
    // @Public() explícito (ver common/decorators/public.decorator.ts).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Roda depois do JwtAuthGuard (ordem de registro = ordem de execução):
    // precisa de request.user já populado para checar @RequirePermissions().
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
