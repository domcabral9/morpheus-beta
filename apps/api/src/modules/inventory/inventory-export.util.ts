import type { InventoryItemWithOpinion } from "./inventory.service";

const CSV_COLUMNS = [
  "id",
  "nome",
  "fabricante",
  "versao",
  "categoria",
  "tipo",
  "provedorHospedagem",
  "area",
  "gestor",
  "gestorEmail",
  "responsavelTecnico",
  "responsavelTecnicoEmail",
  "dataHomologacao",
  "proximaRevisao",
  "status",
  "criticidade",
  "classificacaoDados",
  "parecerTecnico",
  "linksDocumentacao",
] as const;

/** Aspas UTF-8 na frente do CSV - sem isso o Excel (o consumidor mais
 * provável de um CSV em pt-BR) interpreta acentos como Latin-1 e corrompe
 * "Área", "não", etc. */
const UTF8_BOM = "﻿";

/** Escapa um campo pro formato CSV (RFC 4180): aspas quando o valor contém
 * vírgula, aspas ou quebra de linha, dobrando aspas internas. */
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toRow(item: InventoryItemWithOpinion): string[] {
  return [
    item.id,
    item.name,
    item.vendor,
    item.version ?? "",
    item.category,
    item.type,
    item.hostingProvider ?? "",
    item.area.name,
    item.manager.name,
    item.manager.email,
    item.technicalResponsible.name,
    item.technicalResponsible.email,
    item.homologationDate.toISOString().slice(0, 10),
    item.nextReviewDate.toISOString().slice(0, 10),
    item.status,
    item.criticality,
    item.dataClassification,
    item.technicalOpinion?.number ?? "",
    item.documentationLinks.map((link) => `${link.label}: ${link.url}`).join(" | "),
  ];
}

/** Sem lib de terceiros de propósito - CSV manual (join + escaping RFC 4180)
 * é suficientemente simples pra não justificar uma dependência nova, mesmo
 * padrão minimalista já usado no resto da API (ex.: PDF via `pdfkit` direto,
 * sem wrapper). */
export function buildInventoryCsv(items: InventoryItemWithOpinion[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const item of items) {
    lines.push(toRow(item).map(escapeCsvField).join(","));
  }
  return UTF8_BOM + lines.join("\r\n");
}
