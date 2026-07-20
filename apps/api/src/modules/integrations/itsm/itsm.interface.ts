export const ITSM_ADAPTER = Symbol("ITSM_ADAPTER");

export interface CreateTicketInput {
  tenantId: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  externalReference?: string;
}

export interface TicketResult {
  ticketId: string;
}

/**
 * Abstração de abertura de chamado num ITSM externo (ServiceNow, Jira
 * Service Management...) — mesmo raciocínio do SiemAdapter. Consumido por
 * WorkflowService quando uma avaliação é reprovada: abre um chamado de
 * acompanhamento em vez de só notificar o solicitante dentro do próprio
 * Morpheus.
 */
export interface ItsmAdapter {
  createTicket(input: CreateTicketInput): Promise<TicketResult>;
}
