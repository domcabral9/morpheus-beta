import { Module } from "@nestjs/common";
import { AI_PROVIDER } from "./ai-provider.interface";
import { NullAiProvider } from "./null-ai.provider";

/**
 * Não é @Global(): diferente dos adapters de integração (consumidos por
 * vários módulos de negócio já hoje), AiProvider ainda não tem consumidor —
 * um módulo futuro que precisar dele importa AiModule explicitamente.
 */
@Module({
  providers: [{ provide: AI_PROVIDER, useClass: NullAiProvider }],
  exports: [AI_PROVIDER],
})
export class AiModule {}
