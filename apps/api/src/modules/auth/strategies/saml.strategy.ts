import { Injectable, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy, Profile, VerifiedCallback } from "@node-saml/passport-saml";
import { AuthService } from "../auth.service";
import { UsersService } from "../../users/users.service";
import type { UserWithPermissions } from "../../users/users.repository";

// Config sintaticamente válida (nunca usada para validar uma resposta real)
// para que `super()` nunca lance por falta de entryPoint/cert quando o SSO
// está desabilitado — a rejeição acontece em verifyProfile(), de forma
// explícita e com uma mensagem clara, não como um crash de bootstrap.
const DISABLED_CONFIG = {
  issuer: "morpheus-saml-disabled",
  idpCert: "SSO_DISABLED_PLACEHOLDER_CERT",
  callbackUrl: "https://sso-disabled.invalid/callback",
};

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, "saml") {
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {
    const enabled = configService.get<boolean>("SAML_ENABLED") ?? false;
    const options = enabled
      ? {
          entryPoint: configService.getOrThrow<string>("SAML_ENTRY_POINT"),
          issuer: configService.getOrThrow<string>("SAML_ISSUER"),
          idpCert: configService.getOrThrow<string>("SAML_CERT"),
          callbackUrl: configService.getOrThrow<string>("SAML_CALLBACK_URL"),
          wantAssertionsSigned: false,
        }
      : DISABLED_CONFIG;

    // A lib SAML exige dois callbacks no construtor (signon e logout); o
    // mixin PassportStrategy do Nest só sabe injetar automaticamente UM
    // (o último parâmetro, mapeado para `this.validate`). Por isso o signon
    // é passado explicitamente aqui, chamando verifyProfile() nós mesmos —
    // o logout (não implementado; sem endpoint de SLO) fica com o callback
    // que o mixin injeta sozinho, e nunca é de fato acionado.
    super(options, (profile: Profile | null, done: VerifiedCallback) => {
      this.verifyProfile(profile).then(
        (user) => done(null, user),
        (err: Error) => done(err),
      );
    });

    this.enabled = enabled;
  }

  // Nunca chamado no fluxo real (o signon é resolvido explicitamente no
  // callback passado ao super() acima) — existe só para satisfazer o método
  // abstrato que o mixin PassportStrategy exige de toda estratégia.
  async validate(profile: Profile | null): Promise<UserWithPermissions> {
    return this.verifyProfile(profile);
  }

  private async verifyProfile(profile: Profile | null): Promise<UserWithPermissions> {
    if (!this.enabled) {
      throw new NotImplementedException("SSO via SAML não está configurado neste ambiente.");
    }
    if (!profile) {
      throw new UnauthorizedException("Resposta SAML sem perfil de usuário.");
    }

    const email = profile.email ?? profile.mail;
    if (!email) {
      throw new UnauthorizedException("Resposta SAML sem atributo de e-mail.");
    }

    // Ainda não há seleção de tenant por login SSO (subdomínio ou tela de
    // escolha) — cada deploy do IdP atende a um único tenant, configurado
    // aqui. Documentado como limitação a resolver quando o multi-tenant de
    // verdade (Etapa futura) chegar ao SSO.
    const tenantSlug = this.configService.getOrThrow<string>("SAML_TENANT_SLUG");
    const tenantId = await this.authService.resolveTenantIdBySlug(tenantSlug);

    const displayNameAttribute =
      profile["displayName"] ??
      profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
    const name = typeof displayNameAttribute === "string" ? displayNameAttribute : email;

    return this.usersService.findOrProvisionBySso(tenantId, {
      ssoSubject: profile.nameID,
      email,
      name,
    });
  }
}
