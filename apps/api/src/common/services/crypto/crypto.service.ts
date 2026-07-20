import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // recomendado para GCM (96 bits)

/**
 * Criptografia simétrica em repouso (AES-256-GCM) para colunas que não
 * precisam ser buscáveis/indexadas mas também não devem ficar legíveis
 * direto no banco por qualquer um com acesso de leitura ao Postgres — ex.:
 * RefreshToken.ipAddress. Diferente de bcrypt/SHA-256 (usados em senha e
 * hash do próprio token): aqui a operação é reversível de propósito, porque
 * a aplicação eventualmente precisa mostrar o valor original (ex.: uma tela
 * de "sessões ativas" listando de onde cada uma veio).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const encoded = configService.getOrThrow<string>("ENCRYPTION_KEY");
    this.key = Buffer.from(encoded, "base64");
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(".");
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error("Payload criptografado em formato inválido.");
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}
