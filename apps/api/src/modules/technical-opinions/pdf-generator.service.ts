import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { OpinionPdfData } from "./opinion-pdf-data.interface";

const PAGE_MARGIN = 50;
const COLORS = {
  text: "#1f2937",
  muted: "#6b7280",
  border: "#d1d5db",
  heading: "#111827",
};

const STATUS_LABELS: Record<OpinionPdfData["finalStatus"], string> = {
  APPROVED: "Homologado",
  REJECTED: "Rejeitado",
};

// Mesmos rótulos PT-BR já usados no frontend (mensagens de i18n) - o
// parecer inteiro é só PT-BR, sem tradução, então esses mapas ficam
// hardcoded aqui, mesmo estilo de STATUS_LABELS/translateStepStatus.
const ATTACHMENT_CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: "Contrato",
  DPA: "DPA (Acordo de Processamento de Dados)",
  SOC2_REPORT: "Relatório SOC 2",
  ISO27001_CERTIFICATE: "Certificado ISO 27001",
  PENTEST_REPORT: "Relatório de pentest",
  ARCHITECTURE_DOCUMENT: "Documento de arquitetura",
  DPIA: "DPIA (Avaliação de Impacto)",
  PRIVACY_POLICY: "Política de privacidade",
  OTHER: "Outro",
};

const FRESHNESS_STATE_LABELS: Record<string, string> = {
  "up-to-date": "Versão em dia",
  outdated: "Versão desatualizada",
  unknown: "Frescor desconhecido",
};

const REPUTATION_STATE_LABELS: Record<string, string> = {
  "verified-clean": "Reputação limpa (verificada)",
  "verified-suspicious": "Reputação suspeita (verificada)",
  "declared-known": "Declarado conhecido",
  unverified: "Não verificado",
};

const EXPOSURE_STATE_LABELS: Record<string, string> = {
  exposed: "Exposição detectada",
  "no-known-vulnerabilities": "Sem exposição conhecida",
  unverified: "Não verificado",
};

/**
 * Renderiza o parecer técnico em PDF a partir de um payload já achatado
 * (ver OpinionPdfData) — sem acesso a banco, testável isoladamente. Layout
 * deliberadamente simples (pdfkit não tem motor de tabelas nativo): blocos de
 * rótulo/valor e grades desenhadas com linhas, o suficiente para um
 * documento corporativo legível sem depender de um motor de renderização
 * HTML→PDF mais pesado (Puppeteer) só para isso.
 */
@Injectable()
export class PdfGeneratorService {
  build(data: OpinionPdfData): Promise<Buffer> {
    return new Promise((resolvePromise, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolvePromise(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.renderHeader(doc, data);
      this.renderExecutiveContext(doc, data);
      this.renderIdentification(doc, data);
      this.renderInventoryLink(doc, data);
      this.renderRiskResult(doc, data);
      this.renderMethodology(doc, data);
      this.renderQuestionnaire(doc, data);
      this.renderApprovalHistory(doc, data);
      this.renderRecommendations(doc, data);
      this.renderFooter(doc, data);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    const logoSize = 40;
    if (data.logoBuffer) {
      // Posição absoluta (mesmo padrão do QR Code no rodapé): não mexe no
      // cursor doc.y, então o texto abaixo continua fluindo normalmente.
      doc.image(data.logoBuffer, PAGE_MARGIN, PAGE_MARGIN, { fit: [logoSize, logoSize] });
      doc.y = PAGE_MARGIN + logoSize + 10;
    }

    doc.fontSize(9).fillColor(COLORS.muted).text(data.tenantName.toUpperCase(), { align: "right" });
    doc
      .fontSize(18)
      .fillColor(COLORS.heading)
      .text("Parecer Técnico de Homologação de Software", { align: "left" });
    doc.moveDown(0.3);

    const statusColor = data.finalStatus === "APPROVED" ? "#16a34a" : "#dc2626";
    doc
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text(`Autor: ${data.securityTeamName}`, { continued: false });
    doc
      .fillColor(statusColor)
      .text(`Status: ${STATUS_LABELS[data.finalStatus]}`, { continued: false });
    doc
      .fillColor(COLORS.muted)
      .text(`Versão avaliada: ${data.versionLabel}`)
      .text(`Emitido em: ${this.formatDate(data.issuedAt)}`)
      .text(`Número do parecer: ${data.documentNumber}`);
    if (data.linkedTicket) {
      doc.text(`Ticket vinculado: ${data.linkedTicket}`);
    }

    doc.moveDown(1);
    this.horizontalRule(doc);
  }

  /** Resumo executivo determinístico (template, não geração probabilística -
   * ver decisão de não depender de LLM externa) - sempre presente, logo
   * abaixo do cabeçalho. */
  private renderExecutiveContext(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    this.sectionTitle(doc, "Contexto", 11);
    doc.fontSize(10).fillColor(COLORS.text).text(data.executiveContext, { align: "justify" });
    doc.moveDown(1);
  }

  private renderIdentification(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    this.sectionTitle(doc, "Identificação do Software");
    this.keyValue(doc, "Nome do Software", data.softwareName);
    this.keyValue(doc, "Fornecedor", data.vendor);
    if (data.version) this.keyValue(doc, "Versão do Software", data.version);
    if (data.url) this.keyValue(doc, "URL", data.url);
    this.keyValue(doc, "Área Responsável", data.areaName);
    this.keyValue(doc, "Responsável Técnico", `${data.responsibleName} <${data.responsibleEmail}>`);
    this.keyValue(doc, "Criticidade", data.criticality);
    if (data.installerFileHash) {
      this.keyValue(doc, "SHA-256 do instalador", data.installerFileHash);
    }
    doc.moveDown(0.3);
    this.sectionTitle(doc, "Justificativa de Uso", 11);
    doc.fontSize(10).fillColor(COLORS.text).text(data.justification, { align: "justify" });
    doc.moveDown(1);

    this.sectionTitle(doc, "Conformidade do Fornecedor", 11);
    this.keyValue(
      doc,
      "ART (Análise de Risco)",
      data.vendorCompliance.hasRiskAnalysis ? "Sim" : "Não",
    );
    this.keyValue(
      doc,
      "Cláusula de segurança da informação",
      data.vendorCompliance.hasInfoSecClause ? "Sim" : "Não",
    );
    if (data.vendorCompliance.linkedVendor) {
      const { name, tier, tierLabel } = data.vendorCompliance.linkedVendor;
      const tierText =
        tier !== null ? `Tier ${tier} · ${tierLabel}` : "sem avaliação de risco concluída";
      this.keyValue(doc, "Fornecedor cadastrado", `${name} (${tierText})`);
    }
    if (data.attachments.length > 0) {
      const attachmentsText = data.attachments
        .map((attachment) => {
          const category = ATTACHMENT_CATEGORY_LABELS[attachment.category] ?? attachment.category;
          return `${attachment.fileName} (${category})`;
        })
        .join("; ");
      this.keyValue(doc, "Anexos", attachmentsText);
    }
    doc.moveDown(1);
  }

  /** Só presente para avaliações aprovadas (o item de inventário não existe
   * para reprovações - ver o reorder em WorkflowService.decideStep). */
  private renderInventoryLink(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    if (!data.inventoryItem) return;

    this.sectionTitle(doc, "Item de Inventário Vinculado", 11);
    doc
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text("Item de Inventário: ", { continued: true })
      .fillColor("#2563eb")
      .text(data.inventoryItem.url, { link: data.inventoryItem.url, underline: true });
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .text(
        "Os estados abaixo refletem o momento da emissão deste parecer - consulte o link acima para o estado atual.",
      );
    doc.fillColor(COLORS.text).fontSize(10);
    this.keyValue(
      doc,
      "Frescor de versão",
      FRESHNESS_STATE_LABELS[data.inventoryItem.freshnessState] ??
        data.inventoryItem.freshnessState,
    );
    this.keyValue(
      doc,
      "Reputação de ameaça",
      REPUTATION_STATE_LABELS[data.inventoryItem.reputationState] ??
        data.inventoryItem.reputationState,
    );
    this.keyValue(
      doc,
      "Exposição externa",
      EXPOSURE_STATE_LABELS[data.inventoryItem.exposureState] ?? data.inventoryItem.exposureState,
    );
    doc.moveDown(1);
  }

  private renderRiskResult(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    this.sectionTitle(doc, "Resultado do Motor de Risco");

    if (!data.riskScores) {
      doc
        .fontSize(10)
        .fillColor(COLORS.muted)
        .text("Nenhum resultado de risco calculado para esta versão.");
      doc.moveDown(1);
      return;
    }

    const badgeY = doc.y;
    doc
      .roundedRect(PAGE_MARGIN, badgeY, 170, 26, 4)
      .fillAndStroke(data.classificationColor, data.classificationColor);
    doc
      .fillColor("#ffffff")
      .fontSize(12)
      .text(data.classificationLabel, PAGE_MARGIN, badgeY + 7, { width: 170, align: "center" });
    doc.fillColor(COLORS.text).fontSize(10);
    doc.y = badgeY + 34;

    this.keyValue(
      doc,
      "Score de Probabilidade",
      `${data.riskScores.probabilityScore.toFixed(2)} (${data.riskScores.probabilityLevelLabel})`,
    );
    this.keyValue(
      doc,
      "Score de Impacto",
      `${data.riskScores.impactScore.toFixed(2)} (${data.riskScores.impactLevelLabel})`,
    );
    this.keyValue(doc, "Score Total", data.riskScores.totalScore.toFixed(2));
    doc.moveDown(1);
  }

  /** Determinística - parágrafo fixo + pontos críticos calculados a partir
   * das respostas reais desta avaliação (ver `computeTopRiskFactors`), nunca
   * gerada. */
  private renderMethodology(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    this.sectionTitle(doc, "Metodologia", 11);
    doc.fontSize(10).fillColor(COLORS.text).text(data.methodology.summary, { align: "justify" });

    if (data.methodology.topFactors.length > 0) {
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor(COLORS.heading).text("Principais fatores considerados:");
      doc.moveDown(0.1);
      for (const factor of data.methodology.topFactors) {
        doc
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(`• ${factor.questionText} (${factor.contributionLabel})`, { indent: 10 });
      }
    }
    doc.moveDown(1);
  }

  private renderQuestionnaire(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    if (data.categories.length === 0) return;

    this.sectionTitle(doc, "Detalhamento do Questionário");
    for (const category of data.categories) {
      if (category.answers.length === 0) continue;
      doc.moveDown(0.4);
      doc.fontSize(11).fillColor(COLORS.heading).text(category.categoryName, { underline: true });
      doc.moveDown(0.2);
      for (const answer of category.answers) {
        this.keyValue(doc, answer.questionText, answer.answerText);
      }
    }
    doc.moveDown(1);
  }

  private renderApprovalHistory(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    this.sectionTitle(doc, "Histórico de Aprovação");

    if (data.approvalHistory.length === 0) {
      doc.fontSize(10).fillColor(COLORS.muted).text("Nenhuma etapa de workflow registrada.");
      doc.moveDown(1);
      return;
    }

    for (const step of data.approvalHistory) {
      doc
        .fontSize(11)
        .fillColor(COLORS.heading)
        .text(
          `${step.stepName} (${step.responsibleRoleName}) — ${this.translateStepStatus(step.status)}`,
        );
      const details: string[] = [];
      if (step.decidedByName) details.push(`Decidido por: ${step.decidedByName}`);
      if (step.decidedAt) details.push(`Data: ${this.formatDate(step.decidedAt)}`);
      if (details.length > 0) {
        doc.fontSize(9).fillColor(COLORS.muted).text(details.join("  •  "));
      }
      if (step.comments) {
        doc.fontSize(10).fillColor(COLORS.text).text(step.comments, { indent: 10 });
      }
      doc.moveDown(0.5);
    }
    doc.moveDown(0.5);
  }

  /** Só presente quando há ao menos um comentário real de reprovação/ajuste
   * já registrado (ver `buildRecommendations` no service) - nunca inventa um
   * motivo. */
  private renderRecommendations(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    if (!data.recommendations) return;

    this.sectionTitle(doc, "Recomendações");
    for (const reason of data.recommendations.reasons) {
      doc.fontSize(10).fillColor(COLORS.text).text(`• ${reason}`, { indent: 10 });
      doc.moveDown(0.2);
    }
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(data.recommendations.closingNote, { align: "justify" });
    doc.moveDown(1);
  }

  private renderFooter(doc: PDFKit.PDFDocument, data: OpinionPdfData): void {
    this.horizontalRule(doc);
    doc.moveDown(0.5);

    const qrSize = 90;
    const qrY = doc.y;
    doc.image(data.qrCodePng, PAGE_MARGIN, qrY, { width: qrSize, height: qrSize });
    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        "Escaneie para verificar a autenticidade deste parecer",
        PAGE_MARGIN + qrSize + 10,
        qrY + 4,
        {
          width: 380,
        },
      )
      .text(data.verificationUrl, PAGE_MARGIN + qrSize + 10, qrY + 20, { width: 380 });

    doc.y = qrY + qrSize + 10;
    doc
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Documento gerado automaticamente pela plataforma Morpheus. Número: ${data.documentNumber}.`,
      );
  }

  // --- Helpers de layout -----------------------------------------------------------
  private sectionTitle(doc: PDFKit.PDFDocument, text: string, size = 13): void {
    doc.fontSize(size).fillColor(COLORS.heading).text(text, { underline: false });
    doc
      .moveTo(doc.x, doc.y + 2)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 2)
      .strokeColor(COLORS.border)
      .stroke();
    doc.moveDown(0.5);
  }

  private keyValue(doc: PDFKit.PDFDocument, label: string, value: string): void {
    doc
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(`${label}: `, { continued: true })
      .fillColor(COLORS.text)
      .text(value);
  }

  private horizontalRule(doc: PDFKit.PDFDocument): void {
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .strokeColor(COLORS.border)
      .stroke();
    doc.moveDown(0.5);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  private translateStepStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: "Pendente",
      IN_PROGRESS: "Em andamento",
      APPROVED: "Aprovado",
      REJECTED: "Reprovado",
      ADJUSTMENT_REQUESTED: "Ajuste solicitado",
      SKIPPED: "Pulado",
    };
    return map[status] ?? status;
  }
}
