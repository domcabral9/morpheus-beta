import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Implementação própria de TOTP (RFC 6238) sobre HOTP (RFC 4226), em vez de uma
// lib de terceiros: `otplib` (a opção mais popular/mantida) publicou uma
// reescrita major (v13) cujos plugins padrão de cripto/base32 são pacotes
// ESM-only (`@scure/base`) que o Jest/ts-jest (CommonJS) deste projeto não
// consegue transformar - travaria toda a suíte de testes ou exigiria mudar a
// config de transform do projeto inteiro por causa de uma feature isolada. O
// algoritmo em si é curto e bem especificado (HMAC-SHA1 + Base32 padrão RFC
// 4648) - manter aqui, auditável, evita esse acoplamento frágil.

const ISSUER = "Morpheus";
const PERIOD_SECONDS = 30;
const DIGITS = 6;
// ±1 período (30s) de tolerância de relógio — absorve deriva razoável do
// relógio do usuário sem abrir demais a janela de força bruta (o rate-limit
// nas rotas que chamam verifyTotpCode já cobre esse ângulo).
const COUNTER_TOLERANCE_STEPS = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Caractere Base32 inválido no secret TOTP.");
    }
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** HOTP, RFC 4226 — HMAC-SHA1 truncado dinamicamente em `digits` dígitos. */
function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac.readUInt8(hmac.length - 1) & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  const otp = binary % 10 ** DIGITS;
  return otp.toString().padStart(DIGITS, "0");
}

function counterForTime(epochSeconds: number): number {
  return Math.floor(epochSeconds / PERIOD_SECONDS);
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Secret de 160 bits (20 bytes), Base32-encoded — mesmo tamanho recomendado
 * pela RFC 6238 e usado por Google Authenticator/Authy/etc. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** URI `otpauth://` padrão, lida por qualquer app autenticador TOTP via QR code. */
export function buildOtpauthUri(email: string, secretBase32: string): string {
  const label = `${ISSUER}:${email}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotpCode(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const currentCounter = counterForTime(Date.now() / 1000);
  for (let delta = -COUNTER_TOLERANCE_STEPS; delta <= COUNTER_TOLERANCE_STEPS; delta++) {
    if (constantTimeEquals(hotp(secret, currentCounter + delta), code)) {
      return true;
    }
  }
  return false;
}

// Sem 0/O/1/I — evita ambiguidade visual ao digitar um código de recuperação
// à mão a partir de uma tela/papel (alfabeto deliberadamente diferente do
// Base32 padrão usado no secret acima, que precisa seguir RFC 4648 à risca).
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateBackupCode(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** 10 códigos únicos no formato `XXXX-XXXX`, uso único (ver TwoFactorBackupCode). */
export function generateBackupCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateBackupCode());
  }
  return [...codes];
}
