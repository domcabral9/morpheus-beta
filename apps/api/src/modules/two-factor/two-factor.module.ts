import { Module } from "@nestjs/common";
import { TwoFactorRepository } from "./two-factor.repository";
import { TwoFactorService } from "./two-factor.service";

// PrismaService/AuditLogService são globais, não entram em imports. Sem
// `controllers`: as rotas de 2FA moram em AuthController (mesma convenção de
// "ações sobre a própria conta ficam em AuthController", já usada por
// /auth/password e /auth/profile).
@Module({
  providers: [TwoFactorRepository, TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
