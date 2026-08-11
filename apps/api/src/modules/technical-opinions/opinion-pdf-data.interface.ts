/**
 * Payload já achatado/pronto para renderização — o gerador de PDF (pdfkit)
 * não conhece Prisma nem consulta banco, só recebe dados simples. Mantém a
 * lógica de layout testável isoladamente, mesmo padrão de separação já usado
 * no motor de risco (cálculo puro vs. persistência).
 */
export interface OpinionPdfAnswer {
  questionText: string;
  answerText: string;
}

export interface OpinionPdfCategory {
  categoryName: string;
  answers: OpinionPdfAnswer[];
}

export interface OpinionPdfApprovalStep {
  stepName: string;
  responsibleRoleName: string;
  status: string;
  decidedByName: string | null;
  decidedAt: Date | null;
  comments: string | null;
}

export interface OpinionPdfAttachment {
  fileName: string;
  category: string;
  uploadedAt: Date;
}

export interface OpinionPdfVendorCompliance {
  hasRiskAnalysis: boolean;
  hasInfoSecClause: boolean;
  /** `tier`/`tierLabel` nulos quando o fornecedor está vinculado mas ainda
   * não tem nenhuma avaliação de risco concluída (`Vendor.currentTier`
   * nasce nulo). */
  linkedVendor: { name: string; tier: number | null; tierLabel: string | null } | null;
}

/** Só presente para avaliações aprovadas (o item de inventário não existe
 * para reprovações) — ver decisão de reordenar `createFromApprovedAssessment`
 * antes de `generateForAssessment` em `workflow.service.ts`. Os 3 estados
 * refletem o instante exato da emissão do parecer, quase sempre "não
 * verificado" (checagens acontecem depois) — por isso o hyperlink `url`
 * aponta para o item vivo, onde o estado atual sempre pode ser conferido. */
export interface OpinionPdfInventoryItem {
  url: string;
  freshnessState: string;
  reputationState: string;
  exposureState: string;
}

export interface OpinionPdfMethodologyFactor {
  questionText: string;
  contributionLabel: string;
}

export interface OpinionPdfMethodology {
  summary: string;
  topFactors: OpinionPdfMethodologyFactor[];
}

/** Presente só para REJECTED ou quando há ao menos uma etapa
 * ADJUSTMENT_REQUESTED com comentário real — nunca fabricado quando não há
 * motivo registrado por um aprovador de verdade. */
export interface OpinionPdfRecommendations {
  reasons: string[];
  closingNote: string;
}

export interface OpinionPdfData {
  documentNumber: string;
  issuedAt: Date;
  finalStatus: "APPROVED" | "REJECTED";
  classificationLabel: string;
  classificationColor: string;

  tenantName: string;
  securityTeamName: string;
  /** Já resolvido para bytes antes de chegar aqui — o gerador de PDF não faz
   * I/O (nem de disco, nem de rede) para buscar o logo, só desenha o que
   * recebeu. `null` = sem logo configurado, ou logo é um caminho estático do
   * Next.js em vez de uma chave de StorageAdapter (ver
   * `isStorageBackedLogo` em `tenants.service.ts`). */
  logoBuffer?: Buffer | null;

  softwareName: string;
  vendor: string;
  version: string | null;
  url: string | null;
  areaName: string;
  responsibleName: string;
  responsibleEmail: string;
  criticality: string;
  justification: string;
  linkedTicket: string | null;
  installerFileHash: string | null;
  versionLabel: string;

  riskScores: {
    probabilityScore: number;
    impactScore: number;
    totalScore: number;
    probabilityLevelLabel: string;
    impactLevelLabel: string;
  } | null;

  categories: OpinionPdfCategory[];
  approvalHistory: OpinionPdfApprovalStep[];

  /** Resumo executivo montado por template (nome do software + fornecedor +
   * justificativa de uso literal) — determinístico, sem geração probabilística
   * (ver decisão de não depender de LLM externa neste parecer). */
  executiveContext: string;
  vendorCompliance: OpinionPdfVendorCompliance;
  attachments: OpinionPdfAttachment[];
  inventoryItem: OpinionPdfInventoryItem | null;
  methodology: OpinionPdfMethodology;
  recommendations: OpinionPdfRecommendations | null;

  verificationUrl: string;
  qrCodePng: Buffer;
}
