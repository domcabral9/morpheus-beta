import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { IntegrationsPolicyService } from "./integrations-policy.service";
import { UpdateIntegrationsPolicyDto } from "./dto/update-integrations-policy.dto";

/**
 * `GET` aberto a qualquer usuário autenticado (mesma razão das demais
 * policies: quem vai usar o botão "verificar agora" no inventário precisa
 * saber se a integração está habilitada antes de tentar) - a resposta nunca
 * inclui a chave de API, só `hasVirusTotalApiKey`. Só `PATCH` é restrito a
 * super-admin.
 */
@ApiTags("platform-policy")
@Controller("platform/integrations-policy")
export class IntegrationsPolicyController {
  constructor(private readonly integrationsPolicyService: IntegrationsPolicyService) {}

  @Get()
  @ApiOperation({
    summary:
      "Config vigente das integrações externas de enriquecimento (VirusTotal, endoflife.date).",
  })
  getPolicy() {
    return this.integrationsPolicyService.getPolicy();
  }

  @RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
  @Patch()
  @ApiOperation({ summary: "Super-admin: configura as integrações externas de enriquecimento." })
  updatePolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateIntegrationsPolicyDto) {
    return this.integrationsPolicyService.updatePolicy(dto, user.id);
  }
}
