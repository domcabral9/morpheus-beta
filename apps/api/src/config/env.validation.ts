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

    // SMTP (Etapa 10) — opcional de propósito: sem SMTP_HOST configurado, o
    // NotificationsService ainda grava a notificação em `Notification`
    // normalmente, só não tenta enviar e-mail (log avisando, nunca derruba
    // a ação de negócio que disparou a notificação).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: booleanFromEnv(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default("Morpheus <no-reply@morpheus.local>"),
    // Dias de antecedência para marcar um item do inventário como
    // PENDING_REVIEW e notificar o responsável (job diário — ver
    // SoftwareReviewScheduler).
    INVENTORY_REVIEW_WARNING_DAYS: z.coerce.number().default(30),

    // Lidas diretamente de process.env em tracing.ts, antes do ConfigModule
    // existir — declaradas aqui só para documentação e para o restante da
    // aplicação conseguir lê-las via ConfigService se precisar. Sem
    // OTEL_EXPORTER_OTLP_ENDPOINT, os spans vão para o console (dev/CI não
    // precisam de um collector rodando).
    OTEL_SERVICE_NAME: z.string().default("morpheus-api"),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),

    // Rate limiting global (Etapa 14) — janela em ms e máximo de requisições
    // por IP dentro dela. Endpoints sensíveis (login, refresh) têm limites
    // mais estritos via @Throttle() nos controllers.
    THROTTLE_TTL_MS: z.coerce.number().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().default(100),

    // Chave simétrica para o CryptoService (AES-256-GCM) — usada hoje para
    // criptografar RefreshToken.ipAddress em repouso. Precisa ter exatamente
    // 32 bytes quando decodificada de base64 (chave de 256 bits).
    ENCRYPTION_KEY: z
      .string()
      .min(1, "ENCRYPTION_KEY é obrigatório")
      .refine((value) => Buffer.from(value, "base64").length === 32, {
        message: "ENCRYPTION_KEY deve ser uma chave de 256 bits (32 bytes) em base64",
      }),

    // Arquitetura de adapters (Etapa 15) — todas opcionais de propósito:
    // sem a URL configurada, cada adapter só loga um aviso e segue (mesmo
    // padrão do SMTP_HOST). Nenhum SIEM/ITSM/ferramenta de colaboração real
    // é exigido para a aplicação funcionar em dev/CI.
    SIEM_WEBHOOK_URL: z.string().optional(),
    ITSM_WEBHOOK_URL: z.string().optional(),
    ITSM_API_KEY: z.string().optional(),
    COLLABORATION_WEBHOOK_URL: z.string().optional(),
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
