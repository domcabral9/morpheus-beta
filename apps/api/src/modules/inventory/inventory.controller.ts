import { Body, Controller, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { InventoryService } from "./inventory.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { ListInventoryQueryDto } from "./dto/list-inventory.query.dto";
import { ExportInventoryQueryDto } from "./dto/export-inventory.query.dto";
import { CheckDuplicateInventoryQueryDto } from "./dto/check-duplicate-inventory.query.dto";
import { buildInventoryCsv } from "./inventory-export.util";

@ApiTags("inventory")
@RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInventoryQueryDto) {
    return this.inventoryService.list(user, query);
  }

  // Precisa vir antes de `:id` - senão "stats" seria interpretado como um id.
  @Get("stats")
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getStats(user);
  }

  // Precisa vir antes de `:id` - senão "export" seria interpretado como um id.
  @Get("export")
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportInventoryQueryDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const items = await this.inventoryService.exportItems(user, query);
    const date = new Date().toISOString().slice(0, 10);

    if (query.format === "json") {
      res.set({
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="inventario-${date}.json"`,
      });
      res.send(JSON.stringify(items, null, 2));
      return;
    }

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${date}.csv"`,
    });
    res.send(buildInventoryCsv(items));
  }

  // Precisa vir antes de `:id` - senão "check-duplicate" seria interpretado como um id.
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Get("check-duplicate")
  checkDuplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CheckDuplicateInventoryQueryDto,
  ) {
    return this.inventoryService.checkDuplicate(user, query);
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.inventoryService.getById(user, id);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Audit("CREATE", "SoftwareInventoryItem")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(user, dto);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Audit("UPDATE", "SoftwareInventoryItem")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(user, id, dto);
  }
}
