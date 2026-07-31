import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { PasswordPolicyService } from "./password-policy.service";
import { UpdatePasswordPolicyDto } from "./dto/update-password-policy.dto";

/**
 * `GET` fica aberto a qualquer usuário autenticado, sem `@RequirePermissions`:
 * são as regras vigentes (não quem as definiu), e todo mundo precisa lê-las
 * ao definir/trocar uma senha (criação de usuário, reset, autoatendimento) -
 * só `PATCH` (mudar a política) é restrito a super-admin.
 */
@ApiTags("platform-policy")
@Controller("platform/password-policy")
export class PasswordPolicyController {
  constructor(private readonly passwordPolicyService: PasswordPolicyService) {}

  @Get()
  @ApiOperation({ summary: "Política de senha vigente, plataforma inteira." })
  getPolicy() {
    return this.passwordPolicyService.getPolicy();
  }

  @RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
  @Patch()
  @ApiOperation({ summary: "Super-admin: atualiza a política de senha da plataforma." })
  updatePolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePasswordPolicyDto) {
    return this.passwordPolicyService.updatePolicy(dto, user.id);
  }
}
