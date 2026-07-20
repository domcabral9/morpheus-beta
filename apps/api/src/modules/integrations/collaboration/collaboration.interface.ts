export const COLLABORATION_ADAPTER = Symbol("COLLABORATION_ADAPTER");

export interface CollaborationMessage {
  channel: string;
  text: string;
}

/**
 * Abstração de postagem em ferramenta de colaboração (Slack, Microsoft
 * Teams...) via webhook de entrada — mesmo raciocínio do SiemAdapter/
 * ItsmAdapter. Diferente de NotificationsService (Etapa 10), que notifica
 * usuários individuais dentro do próprio Morpheus: isto é para alertar um
 * canal/equipe inteira sobre eventos de alto risco, fora da aplicação.
 * Consumido por WorkflowService na aprovação final de avaliações com
 * criticidade HIGH/CRITICAL.
 */
export interface CollaborationAdapter {
  postMessage(message: CollaborationMessage): Promise<void>;
}
