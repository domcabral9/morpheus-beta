import { ExecutionContext, Injectable, NotImplementedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";

/**
 * Checa SAML_ENABLED antes de delegar para o AuthGuard('saml') real. Sem
 * isso, a rota de início de login (redirect para o IdP) tentaria redirecionar
 * para um `entryPoint` inexistente quando o SSO está desabilitado — o
 * SamlStrategy.validate() só protege o callback, não essa etapa inicial.
 */
@Injectable()
export class SamlAuthGuard extends AuthGuard("saml") {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    if (!this.configService.get<boolean>("SAML_ENABLED")) {
      throw new NotImplementedException("SSO via SAML não está configurado neste ambiente.");
    }
    return super.canActivate(context);
  }
}
