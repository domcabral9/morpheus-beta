import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { TwoFactorModule } from "../two-factor/two-factor.module";
import { PlatformPolicyModule } from "../platform-policy/platform-policy.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { PreAuthStrategy } from "./strategies/preauth.strategy";
import { SamlStrategy } from "./strategies/saml.strategy";
import { OneTimeCodeRepository } from "./one-time-code.repository";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordlessService } from "./passwordless.service";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    TwoFactorModule,
    PlatformPolicyModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    PreAuthStrategy,
    SamlStrategy,
    OneTimeCodeRepository,
    EmailVerificationService,
    PasswordlessService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
