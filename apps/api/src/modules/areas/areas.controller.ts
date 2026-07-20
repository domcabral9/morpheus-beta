import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AreasService } from "./areas.service";

@ApiTags("areas")
@Controller("areas")
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.areasService.findAllActive(user.tenantId);
  }
}
