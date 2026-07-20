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

export interface OpinionPdfData {
  documentNumber: string;
  issuedAt: Date;
  finalStatus: "APPROVED" | "REJECTED";
  classificationLabel: string;
  classificationColor: string;

  tenantName: string;
  securityTeamName: string;
  logoUrl?: string | null;

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

  verificationUrl: string;
  qrCodePng: Buffer;
}
