import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CryptoService } from "./crypto.service";

const VALID_KEY = "2CJIB+zn5Gu5HfqYYlyTMFeEnzaTwfg+Ta5TLf8WoMk=";

async function makeService(key: string): Promise<CryptoService> {
  const moduleRef = await Test.createTestingModule({
    providers: [CryptoService, { provide: ConfigService, useValue: { getOrThrow: () => key } }],
  }).compile();
  return moduleRef.get(CryptoService);
}

describe("CryptoService", () => {
  it("faz o round-trip de encrypt/decrypt corretamente", async () => {
    const service = await makeService(VALID_KEY);
    const encrypted = service.encrypt("203.0.113.10");
    expect(encrypted).not.toBe("203.0.113.10");
    expect(service.decrypt(encrypted)).toBe("203.0.113.10");
  });

  it("gera um resultado diferente a cada chamada (IV aleatório)", async () => {
    const service = await makeService(VALID_KEY);
    const first = service.encrypt("mesmo-valor");
    const second = service.encrypt("mesmo-valor");
    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe("mesmo-valor");
    expect(service.decrypt(second)).toBe("mesmo-valor");
  });

  it("lança ao decriptar um payload malformado", async () => {
    const service = await makeService(VALID_KEY);
    expect(() => service.decrypt("nao-e-um-payload-valido")).toThrow();
  });

  it("lança ao decriptar um payload adulterado (authTag inválido)", async () => {
    const service = await makeService(VALID_KEY);
    const encrypted = service.encrypt("valor-secreto");
    const [iv, authTag, ciphertext] = encrypted.split(".");
    const tamperedCiphertext = Buffer.from(ciphertext!, "base64");
    tamperedCiphertext[0] = (tamperedCiphertext[0] ?? 0) ^ 0xff;
    const tampered = [iv, authTag, tamperedCiphertext.toString("base64")].join(".");
    expect(() => service.decrypt(tampered)).toThrow();
  });
});
