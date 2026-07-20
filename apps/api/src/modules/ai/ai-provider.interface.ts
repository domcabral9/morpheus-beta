export const AI_PROVIDER = Symbol("AI_PROVIDER");

export interface AiCompletionRequest {
  prompt: string;
  maxTokens?: number;
}

export interface AiCompletionResult {
  text: string;
}

/**
 * Provider Pattern para IA (Etapa 15) — mesma forma dos adapters de
 * integração desta etapa (interface + token + implementação trocável), mas
 * deliberadamente sem consumidor de negócio ainda: o roteiro pede "apenas
 * estrutura/interfaces" para este item. NullAiProvider prova que a
 * abstração compila e é injetável; um provider real (Anthropic, por
 * exemplo) entra numa etapa futura sem precisar tocar em quem eventualmente
 * consumir `AiProvider`.
 */
export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
