import { Injectable, PipeTransform } from "@nestjs/common";

// Caracteres de controle exceto tab/LF/CR (que fazem parte de texto livre
// legítimo, ex.: um textarea de justificativa) — nulos e outros bytes de
// controle não têm motivo para chegar até o banco/PDF.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Roda antes do ValidationPipe (registrado primeiro em main.ts): faz trim e
 * remove caracteres de controle de toda string em body/query/params, de
 * forma recursiva. ValidationPipe continua responsável por whitelist/tipos —
 * este pipe só normaliza o conteúdo textual, não valida forma.
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === "string") {
      return value.replace(CONTROL_CHARS, "").trim();
    }
    // Buffer/TypedArray (ex.: file.buffer de um upload via @UploadedFile())
    // também é `typeof "object"` — sem este guard, a recursão abaixo trata
    // cada byte como uma entrada de objeto (Object.entries de um Buffer dá
    // pares índice->byte) e devolve um objeto plano {0: 137, 1: 80, ...} no
    // lugar do Buffer real, quebrando qualquer upload de arquivo que passe
    // por este pipe global.
    if (ArrayBuffer.isView(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      const result: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        result[key] = this.sanitize(entry);
      }
      return result;
    }
    return value;
  }
}
