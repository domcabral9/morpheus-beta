import { z } from "zod";

// `z.coerce.boolean()` faz `Boolean(valor)` por baixo dos panos — qualquer
// string não-vazia é truthy em JS, então `SAML_ENABLED=false` viraria `true`.
// Este helper só aceita literalmente "true"/"false" (e vazio/ausente = false).
const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === "" ? defaultValue : value === "true"));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().default(3001),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),

    // Base URL pública da API — usada para montar o link de verificação
    // codificado no QR Code do parecer técnico (Etapa 7). Sem protocolo/porta
    // fixos hardcoded porque isso muda entre dev/staging/produção.
    PUBLIC_API_URL: z.string().default("http://localhost:3001"),
    STORAGE_DIR: z.string().default("./storage"),

    JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET deve ter ao menos 16 caracteres"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET deve ter ao menos 16 caracteres"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    SAML_ENABLED: booleanFromEnv(false),
    SAML_ENTRY_POINT: z.string().optional(),
    SAML_ISSUER: z.string().optional(),
    SAML_CERT: z.string().optional(),
    SAML_CALLBACK_URL: z.string().optional(),
    // Cada deploy do IdP atende um único tenant (ver comentário em
    // SamlStrategy) até existir seleção de tenant de verdade no fluxo SSO.
    SAML_TENANT_SLUG: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.SAML_ENABLED) return;
    for (const key of [
      "SAML_ENTRY_POINT",
      "SAML_ISSUER",
      "SAML_CERT",
      "SAML_CALLBACK_URL",
      "SAML_TENANT_SLUG",
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} é obrigatório quando SAML_ENABLED=true`,
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuração de ambiente inválida: ${message}`);
  }

  return parsed.data;
}
