export interface PasswordPolicyRules {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const DIGIT_PATTERN = /[0-9]/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

/**
 * Função pura, sem banco - mesmo padrão de `vendor-tier.util.ts`. Retorna as
 * mensagens (pt-BR) das regras violadas; array vazio = senha válida. Regras
 * são runtime-configuráveis (`PlatformPasswordPolicy`), por isso a validação
 * não pode ser um `@Matches` estático no DTO.
 */
export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicyRules,
): string[] {
  const violations: string[] = [];

  if (password.length < policy.minLength) {
    violations.push(`Mínimo de ${policy.minLength} caracteres.`);
  }
  if (policy.requireUppercase && !UPPERCASE_PATTERN.test(password)) {
    violations.push("Deve conter ao menos uma letra maiúscula.");
  }
  if (policy.requireLowercase && !LOWERCASE_PATTERN.test(password)) {
    violations.push("Deve conter ao menos uma letra minúscula.");
  }
  if (policy.requireDigit && !DIGIT_PATTERN.test(password)) {
    violations.push("Deve conter ao menos um dígito.");
  }
  if (policy.requireSymbol && !SYMBOL_PATTERN.test(password)) {
    violations.push("Deve conter ao menos um símbolo (caractere não alfanumérico).");
  }

  return violations;
}
