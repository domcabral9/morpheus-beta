import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { PasswordlessPolicyService } from "./passwordless-policy.service";
import { UpdatePasswordlessPolicyDto } from "./dto/update-passwordless-policy.dto";

/**
 * `GET` aberto a qualquer usuário autenticado (mesma razão de
 * TwoFactorPolicyController: o frontend precisa saber se passwordless está
 * disponível na plataforma pra mostrar/esconder o botão de login) - só
 * `PATCH` é restrito a super-admin.
 */
@ApiTags("platform-policy")
@Controller("platform/passwordless-policy")
export class PasswordlessPolicyController {
  constructor(private readonly passwordlessPolicyService: PasswordlessPolicyService) {}

  @Get()
  @ApiOperation({ summary: "Política de login passwordless vigente, plataforma inteira." })
  getPolicy() {
    return this.passwordlessPolicyService.getPolicy();
  }

  @RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
  @Patch()
  @ApiOperation({ summary: "Super-admin: liga/desliga o login passwordless da plataforma." })
  updatePolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePasswordlessPolicyDto) {
    return this.passwordlessPolicyService.updatePolicy(dto.enabled, user.id);
  }
}
