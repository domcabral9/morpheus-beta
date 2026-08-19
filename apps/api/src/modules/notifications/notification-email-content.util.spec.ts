import { renderNotificationEmailContent } from "./notification-email-content.util";

describe("renderNotificationEmailContent", () => {
  it("renders NEW_REQUEST with software name and step name", () => {
    const { subject, body } = renderNotificationEmailContent("NEW_REQUEST", {
      softwareName: "Excel",
      stepName: "Aprovação jurídica",
    });
    expect(subject).toContain("Excel");
    expect(body).toContain("Excel");
    expect(body).toContain("Aprovação jurídica");
  });

  it("renders APPROVAL with software name only", () => {
    const { subject, body } = renderNotificationEmailContent("APPROVAL", {
      softwareName: "Excel",
    });
    expect(subject).toContain("Excel");
    expect(body).toContain("homologada");
  });

  it("renders REJECTION with software name and step name", () => {
    const { body } = renderNotificationEmailContent("REJECTION", {
      softwareName: "Excel",
      stepName: "Segurança",
    });
    expect(body).toContain("Excel");
    expect(body).toContain("Segurança");
  });

  it("renders ADJUSTMENT_REQUEST with software name and step name", () => {
    const { body } = renderNotificationEmailContent("ADJUSTMENT_REQUEST", {
      softwareName: "Excel",
      stepName: "Jurídico",
    });
    expect(body).toContain("Jurídico");
    expect(body).toContain("Excel");
  });

  it("renders HOMOLOGATION_EXPIRING formatting the ISO date pt-BR", () => {
    const { body } = renderNotificationEmailContent("HOMOLOGATION_EXPIRING", {
      itemName: "Adobe Reader",
      vendor: "Adobe Inc.",
      nextReviewDate: "2026-09-01T00:00:00.000Z",
    });
    expect(body).toContain("Adobe Reader");
    expect(body).toContain("Adobe Inc.");
    expect(body).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("renders OPINION_ISSUED with opinion number and classification", () => {
    const { body } = renderNotificationEmailContent("OPINION_ISSUED", {
      softwareName: "Excel",
      number: "SECOPS-SW-001",
      classificationLabel: "Baixo risco",
    });
    expect(body).toContain("SECOPS-SW-001");
    expect(body).toContain("Baixo risco");
  });

  it("renders RENEWAL_PENDING formatting the deadline pt-BR", () => {
    const { body } = renderNotificationEmailContent("RENEWAL_PENDING", {
      itemName: "Adobe Reader",
      vendor: "Adobe Inc.",
      deadline: "2026-09-15T00:00:00.000Z",
    });
    expect(body).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("renders RENEWAL_PENDING_REQUESTER_INACTIVE mentioning the inactive requester", () => {
    const { body } = renderNotificationEmailContent("RENEWAL_PENDING_REQUESTER_INACTIVE", {
      itemName: "Adobe Reader",
      vendor: "Adobe Inc.",
      deadline: "2026-09-15T00:00:00.000Z",
    });
    expect(body).toContain("inativo");
  });

  it("renders RENEWAL_REQUESTER_REASSIGNED with software name and vendor", () => {
    const { body } = renderNotificationEmailContent("RENEWAL_REQUESTER_REASSIGNED", {
      softwareName: "Adobe Reader",
      vendor: "Adobe Inc.",
    });
    expect(body).toContain("Adobe Reader");
    expect(body).toContain("Adobe Inc.");
  });

  it("renders RENEWAL_OVERDUE with a single unified body (no admin/manager variant)", () => {
    const { body } = renderNotificationEmailContent("RENEWAL_OVERDUE", {
      itemName: "Adobe Reader",
      vendor: "Adobe Inc.",
    });
    expect(body).toContain("Adobe Reader");
    expect(body).toContain("bloqueada");
  });

  it("renders VENDOR_REASSESSMENT_DUE with tier and label", () => {
    const { body } = renderNotificationEmailContent("VENDOR_REASSESSMENT_DUE", {
      vendorName: "DocuSign Inc.",
      tier: 2,
      tierLabel: "Risco moderado",
    });
    expect(body).toContain("DocuSign Inc.");
    expect(body).toContain("Tier 2");
    expect(body).toContain("Risco moderado");
  });

  it("renders VENDOR_REASSESSMENT_DUE_PERFORMER_INACTIVE mentioning the inactive performer", () => {
    const { body } = renderNotificationEmailContent("VENDOR_REASSESSMENT_DUE_PERFORMER_INACTIVE", {
      vendorName: "DocuSign Inc.",
      tier: 2,
      tierLabel: "Risco moderado",
    });
    expect(body).toContain("inativo");
  });

  it("renders INVENTORY_APPROVAL_REQUESTED with item name", () => {
    const { body } = renderNotificationEmailContent("INVENTORY_APPROVAL_REQUESTED", {
      itemName: "Legacy ERP",
    });
    expect(body).toContain("Legacy ERP");
  });

  it("renders INVENTORY_ITEM_APPROVED with item name", () => {
    const { body } = renderNotificationEmailContent("INVENTORY_ITEM_APPROVED", {
      itemName: "Legacy ERP",
    });
    expect(body).toContain("aprovado");
    expect(body).toContain("Legacy ERP");
  });

  it("renders INVENTORY_ITEM_REJECTED with the raw rejection reason interpolated", () => {
    const { body } = renderNotificationEmailContent("INVENTORY_ITEM_REJECTED", {
      itemName: "Legacy ERP",
      reason: "Falta documentação de contrato",
    });
    expect(body).toContain("Legacy ERP");
    expect(body).toContain("Falta documentação de contrato");
  });

  it("renders VENDOR_DATA_INCOMPLETE mentioning the software and vendor names", () => {
    const { subject, body } = renderNotificationEmailContent("VENDOR_DATA_INCOMPLETE", {
      softwareName: "Sistema X",
      vendorName: "Fornecedor Teste",
    });
    expect(subject).toContain("Sistema X");
    expect(body).toContain("Fornecedor Teste");
    expect(body).toContain("incompleto");
  });

  it("renders VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL mentioning the software and vendor names", () => {
    const { subject, body } = renderNotificationEmailContent(
      "VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL",
      { softwareName: "Sistema X", vendorName: "Fornecedor Teste" },
    );
    expect(subject).toContain("Sistema X");
    expect(body).toContain("Fornecedor Teste");
    expect(body).toContain("bloqueada");
  });

  it("falls back to a generic message for the dead NEW_COMMENT type", () => {
    const { subject, body } = renderNotificationEmailContent("NEW_COMMENT", {});
    expect(subject).toBeTruthy();
    expect(body).toBeTruthy();
  });
});
