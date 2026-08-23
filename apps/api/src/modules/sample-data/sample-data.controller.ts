import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { SampleDataService } from "./sample-data.service";
import { SampleEntityType } from "./sample-data.repository";
import { ListSampleDataQueryDto } from "./dto/list-sample-data.query.dto";

const VALID_ENTITY_TYPES: readonly SampleEntityType[] = ["vendor", "inventory-item", "assessment"];

function assertValidEntityType(value: string): SampleEntityType {
  if (!VALID_ENTITY_TYPES.includes(value as SampleEntityType)) {
    throw new BadRequestException(
      `Tipo de entidade inválido - use um de: ${VALID_ENTITY_TYPES.join(", ")}.`,
    );
  }
  return value as SampleEntityType;
}

/** Ferramenta operacional restrita a super-admin - gerencia dado de teste
 * efêmero (`isSampleData: true`) em Vendor/SoftwareInventoryItem/Assessment,
 * cross-tenant por padrão. Diferente das amostras permanentes de portfólio
 * (docs/demo-data-checklist.md), que nunca passam por aqui. */
@ApiTags("platform")
@Controller("platform/sample-data")
@RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
export class SampleDataController {
  constructor(private readonly service: SampleDataService) {}

  @Get()
  list(@Query() query: ListSampleDataQueryDto) {
    return this.service.list({
      tenantId: query.tenantId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Delete(":entityType/:id")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("entityType") entityType: string,
    @Param("id") id: string,
  ) {
    await this.service.remove(user, assertValidEntityType(entityType), id);
  }
}
