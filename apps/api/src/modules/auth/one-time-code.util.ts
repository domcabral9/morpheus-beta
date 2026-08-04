import { createHash, randomInt } from "node:crypto";

export const ONE_TIME_CODE_TTL_MS = 10 * 60 * 1000;
export const ONE_TIME_CODE_MAX_ATTEMPTS = 5;

export function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** SHA-256, não bcrypt: expiração curta + limite de tentativas já cobrem o
 * risco de força bruta - hash lento seria custo sem benefício real aqui
 * (mesma técnica já usada pro hash de refresh token em auth.service.ts). */
export function hashOneTimeCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
