import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Garante que toda requisição tenha um Correlation ID (reaproveitando o enviado
 * pelo cliente, se houver). É registrado via `app.use()` em main.ts antes do
 * bootstrap do módulo de logging, para que o pino-http já encontre o header
 * pronto ao gerar o `req.id` dos logs estruturados.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const correlationId =
    typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();

  req.headers[CORRELATION_ID_HEADER] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
}
