import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { TwoFactorModule } from "../two-factor/two-factor.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { PreAuthStrategy } from "./strategies/preauth.strategy";
import { SamlStrategy } from "./strategies/saml.strategy";
import { OneTimeCodeRepository } from "./one-time-code.repository";
import { EmailVerificationService } from "./email-verification.service";

@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule, TwoFactorModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    PreAuthStrategy,
    SamlStrategy,
    OneTimeCodeRepository,
    EmailVerificationService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
