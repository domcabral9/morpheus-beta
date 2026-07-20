import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "./ai-provider.interface";

/**
 * Único provider hoje — não tenta simular uma resposta de IA (diferente do
 * SmtpEmailAdapter/adapters de integração, que degradam para "logar e
 * seguir"): pedir uma completion sem provider real configurado é um erro de
 * quem chamou, não um evento esperado, então lança em vez de devolver texto
 * vazio ou inventado.
 */
@Injectable()
export class NullAiProvider implements AiProvider {
  private readonly logger = new Logger(NullAiProvider.name);

  complete(_request: AiCompletionRequest): Promise<AiCompletionResult> {
    this.logger.warn("Nenhum AiProvider real configurado — NullAiProvider está ativo.");
    throw new ServiceUnavailableException("Nenhum provedor de IA configurado.");
  }
}
