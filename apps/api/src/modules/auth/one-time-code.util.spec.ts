import { generateSixDigitCode, hashOneTimeCode } from "./one-time-code.util";

describe("generateSixDigitCode", () => {
  it("gera sempre 6 dígitos numéricos, com zero à esquerda quando necessário", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateSixDigitCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("gera códigos diferentes entre chamadas (não determinístico)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateSixDigitCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("hashOneTimeCode", () => {
  it("é determinístico para o mesmo código", () => {
    expect(hashOneTimeCode("123456")).toBe(hashOneTimeCode("123456"));
  });

  it("nunca devolve o código em claro", () => {
    expect(hashOneTimeCode("123456")).not.toContain("123456");
  });

  it("hashes diferentes pra códigos diferentes", () => {
    expect(hashOneTimeCode("123456")).not.toBe(hashOneTimeCode("654321"));
  });
});
