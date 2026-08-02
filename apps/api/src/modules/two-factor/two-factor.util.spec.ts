import {
  generateTotpSecret,
  buildOtpauthUri,
  verifyTotpCode,
  generateBackupCodes,
} from "./two-factor.util";

describe("generateTotpSecret", () => {
  it("gera um secret Base32 não vazio", () => {
    const secret = generateTotpSecret();
    expect(secret).toEqual(expect.any(String));
    expect(secret.length).toBeGreaterThan(0);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it("gera secrets diferentes a cada chamada", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("buildOtpauthUri", () => {
  it("monta uma URI otpauth:// com o email e o issuer Morpheus", () => {
    const secret = generateTotpSecret();
    const uri = buildOtpauthUri("ana@example.com", secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("Morpheus");
    expect(uri).toContain(encodeURIComponent("Morpheus:ana@example.com"));
    expect(uri).toContain(`secret=${secret}`);
  });
});

describe("verifyTotpCode", () => {
  it("aceita um código gerado a partir do vetor de teste da RFC 6238 (secret fixo)", () => {
    // RFC 6238 Apêndice B usa o secret ASCII "12345678901234567890" (SHA1),
    // Base32 disso é "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" - T=59s (contador 1)
    // produz o código 6 dígitos "287082" nos vetores de teste oficiais.
    const secretBase32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const originalNow = Date.now;
    Date.now = () => 59_000;
    try {
      expect(verifyTotpCode(secretBase32, "287082")).toBe(true);
    } finally {
      Date.now = originalNow;
    }
  });

  it("rejeita um código arbitrário", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("rejeita um código com formato inválido (não 6 dígitos)", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "12AB56")).toBe(false);
    expect(verifyTotpCode(secret, "12345")).toBe(false);
  });
});

describe("generateBackupCodes", () => {
  it("gera 10 códigos por padrão", () => {
    expect(generateBackupCodes()).toHaveLength(10);
  });

  it("gera códigos únicos no formato XXXX-XXXX, sem caracteres ambíguos", () => {
    const codes = generateBackupCodes(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/,
      );
    }
  });
});
