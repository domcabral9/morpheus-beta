// Precisa ser o primeiro require do processo, antes de qualquer outro módulo
// (inclusive reflect-metadata) — a auto-instrumentação do OpenTelemetry só
// consegue interceptar módulos (http, express, pg) que ainda não foram
// carregados quando ela roda. Ver comentário completo em tracing.ts.
import "./tracing";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { correlationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { SanitizationPipe } from "./common/pipes/sanitization.pipe";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  // Precisa ser registrado antes do middleware de logging (nestjs-pino), para
  // que o Correlation ID já esteja no header quando os logs forem gerados.
  app.use(correlationIdMiddleware);
  app.use(helmet());
  // Necessário para o AuthController ler o cookie httpOnly do refresh token.
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>("CORS_ORIGIN", "http://localhost:3000");
  app.enableCors({ origin: corsOrigin, credentials: true });

  // SanitizationPipe roda primeiro (normaliza o conteúdo textual), depois
  // ValidationPipe (valida forma/tipos contra o DTO).
  app.useGlobalPipes(
    new SanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Morpheus API")
    .setDescription(
      "API da plataforma de homologação e avaliação de risco de software (anti Shadow IT).",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = configService.get<number>("API_PORT", 3001);
  await app.listen(port);
}

void bootstrap();
