import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { TwoFactorPolicyService } from "./two-factor-policy.service";
import { UpdateTwoFactorPolicyDto } from "./dto/update-two-factor-policy.dto";

/**
 * `GET` aberto a qualquer usuário autenticado (mesma razão de
 * PasswordPolicyController: todo usuário precisa saber se a organização
 * recomenda 2FA para si, via GET /auth/profile) - só `PATCH` é restrito a
 * super-admin.
 */
@ApiTags("platform-policy")
@Controller("platform/two-factor-policy")
export class TwoFactorPolicyController {
  constructor(private readonly twoFactorPolicyService: TwoFactorPolicyService) {}

  @Get()
  @ApiOperation({ summary: "Política de exigência de 2FA vigente, plataforma inteira." })
  getPolicy() {
    return this.twoFactorPolicyService.getPolicy();
  }

  @RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
  @Patch()
  @ApiOperation({ summary: "Super-admin: liga/desliga a exigência de 2FA da plataforma." })
  updatePolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTwoFactorPolicyDto) {
    return this.twoFactorPolicyService.updatePolicy(dto.enforced, user.id);
  }
}
