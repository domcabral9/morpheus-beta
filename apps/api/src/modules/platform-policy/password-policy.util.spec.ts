import { validatePasswordAgainstPolicy, PasswordPolicyRules } from "./password-policy.util";

const ALL_RULES: PasswordPolicyRules = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
};

const NO_RULES: PasswordPolicyRules = {
  minLength: 0,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
  requireSymbol: false,
};

describe("validatePasswordAgainstPolicy", () => {
  it("senha compatível com todas as regras não gera violação", () => {
    expect(validatePasswordAgainstPolicy("Demo@12345", ALL_RULES)).toEqual([]);
  });

  it("com todas as regras desligadas, qualquer senha não vazia é válida", () => {
    expect(validatePasswordAgainstPolicy("a", NO_RULES)).toEqual([]);
  });

  it("rejeita comprimento abaixo do mínimo", () => {
    const violations = validatePasswordAgainstPolicy("Ab1@abc", { ...ALL_RULES, minLength: 8 });
    expect(violations).toContain("Mínimo de 8 caracteres.");
  });

  it("aceita comprimento no limite exato do mínimo", () => {
    const violations = validatePasswordAgainstPolicy("Ab1@abcd", { ...ALL_RULES, minLength: 8 });
    expect(violations).not.toContain("Mínimo de 8 caracteres.");
  });

  it("rejeita ausência de maiúscula quando exigida", () => {
    const violations = validatePasswordAgainstPolicy("demo@12345", ALL_RULES);
    expect(violations).toContain("Deve conter ao menos uma letra maiúscula.");
  });

  it("rejeita ausência de minúscula quando exigida", () => {
    const violations = validatePasswordAgainstPolicy("DEMO@12345", ALL_RULES);
    expect(violations).toContain("Deve conter ao menos uma letra minúscula.");
  });

  it("rejeita ausência de dígito quando exigido", () => {
    const violations = validatePasswordAgainstPolicy("Demo@abcde", ALL_RULES);
    expect(violations).toContain("Deve conter ao menos um dígito.");
  });

  it("rejeita ausência de símbolo quando exigido", () => {
    const violations = validatePasswordAgainstPolicy("Demo12345", ALL_RULES);
    expect(violations).toContain("Deve conter ao menos um símbolo (caractere não alfanumérico).");
  });

  it("acumula múltiplas violações simultâneas", () => {
    const violations = validatePasswordAgainstPolicy("abc", ALL_RULES);
    expect(violations.length).toBeGreaterThan(1);
  });

  it("toggle individual desligado não é cobrado mesmo com senha fraca nesse aspecto", () => {
    const violations = validatePasswordAgainstPolicy("demo123456", {
      ...ALL_RULES,
      requireUppercase: false,
      requireSymbol: false,
    });
    expect(violations).toEqual([]);
  });
});
