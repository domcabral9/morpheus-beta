export interface VendorCompletenessInput {
  name: string | null | undefined;
  legalName: string | null | undefined;
  taxId: string | null | undefined;
  businessCriticality: string | null | undefined;
}

/**
 * Completude cadastral mínima do fornecedor (Nome + Razão Social + CNPJ +
 * Criticidade) - obrigatória pro fornecedor contar como "ativo e vivo" em
 * `/vendors` e pra desbloquear a decisão de aprovação no workflow (ver
 * `WorkflowService.decideStep`), mas NUNCA bloqueia iniciar uma homologação
 * nova (o cadastro rápido continua exigindo só nome+criticidade). Só checa
 * presença (trim), não formato de CNPJ - mesmo nível de rigor que o resto do
 * cadastro de fornecedor hoje.
 */
export function isVendorComplete(vendor: VendorCompletenessInput): boolean {
  return (
    !!vendor.name?.trim() &&
    !!vendor.legalName?.trim() &&
    !!vendor.taxId?.trim() &&
    !!vendor.businessCriticality
  );
}
