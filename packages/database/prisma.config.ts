import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// A CLI do Prisma roda com cwd = packages/database; carregamos o .env da raiz
// do monorepo explicitamente para não depender de onde o comando foi chamado.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

// `prisma generate` (rodado durante o build da imagem Docker, antes do
// container ter as env vars reais do docker-compose) não abre conexão
// nenhuma — só lê o schema. Usamos um placeholder nesse cenário em vez do
// helper `env()` do Prisma, que lançaria erro e quebraria o build só por
// causa de uma variável que essa etapa específica não usa de verdade.
// `migrate`/`studio`/`seed`, que fazem conexão real, sempre têm o .env
// carregado acima (dev) ou a env var injetada pelo docker-compose (produção).
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
