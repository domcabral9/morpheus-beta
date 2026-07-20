import * as QRCode from "qrcode";
import { PdfGeneratorService } from "./pdf-generator.service";
import type { OpinionPdfData } from "./opinion-pdf-data.interface";

function makeData(qrCodePng: Buffer, overrides: Partial<OpinionPdfData> = {}): OpinionPdfData {
  return {
    documentNumber: "SECOPS-SW-072026-001",
    issuedAt: new Date("2026-07-20T12:00:00Z"),
    finalStatus: "APPROVED",
    classificationLabel: "Homologado",
    classificationColor: "#16a34a",
    tenantName: "Empresa Demo",
    securityTeamName: "Equipe de Segurança da Informação",
    logoUrl: null,
    softwareName: "Sistema X",
    vendor: "Fornecedor X",
    version: "1.0.0",
    url: null,
    areaName: "TI",
    responsibleName: "Responsável",
    responsibleEmail: "resp@example.com",
    criticality: "MEDIUM",
    justification: "Justificativa de uso do software.",
    linkedTicket: null,
    installerFileHash: null,
    versionLabel: "v1.0",
    riskScores: {
      probabilityScore: 4.5,
      impactScore: 4.2,
      totalScore: 4.3,
      probabilityLevelLabel: "Baixa",
      impactLevelLabel: "Baixo",
    },
    categories: [
      {
        categoryName: "Segurança",
        answers: [{ questionText: "Usa MFA?", answerText: "Sim" }],
      },
    ],
    approvalHistory: [
      {
        stepName: "Gestor da Área",
        responsibleRoleName: "Gestor da Área",
        status: "APPROVED",
        decidedByName: "Fulano",
        decidedAt: new Date("2026-07-20T11:00:00Z"),
        comments: "Aprovado sem ressalvas.",
      },
    ],
    verificationUrl: "http://localhost:3001/technical-opinions/verify/demo/SECOPS-SW-072026-001",
    qrCodePng,
    ...overrides,
  };
}

describe("PdfGeneratorService", () => {
  let qrCodePng: Buffer;

  beforeAll(async () => {
    qrCodePng = await QRCode.toBuffer("http://localhost:3001/verify/demo/SECOPS-SW-072026-001", {
      type: "png",
      width: 240,
    });
  });

  it("gera um Buffer com o cabeçalho mágico de um PDF válido", async () => {
    const service = new PdfGeneratorService();
    const buffer = await service.build(makeData(qrCodePng));

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("não falha quando não há resultado de risco nem histórico de aprovação", async () => {
    const service = new PdfGeneratorService();
    const buffer = await service.build(
      makeData(qrCodePng, { riskScores: null, approvalHistory: [], categories: [] }),
    );
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
