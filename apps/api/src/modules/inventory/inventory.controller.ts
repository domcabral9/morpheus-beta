import { Body, Controller, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
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
import {
  ApproveInventoryApprovalDto,
  RejectInventoryApprovalDto,
} from "./dto/decide-inventory-approval.dto";
import { SearchEolProductsQueryDto } from "./dto/search-eol-products.query.dto";
import { LinkEolProductDto } from "./dto/link-eol-product.dto";
import { SetReputationDeclaredKnownDto } from "./dto/set-reputation-declared-known.dto";
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
  // Sem @RequirePermissions extra (só a herdada, `inventory:view`, do controller): usado tanto
  // pelo cadastro manual de inventário (`inventory:manage`) quanto pela tela de solicitação de
  // avaliação (`assessments:create`) - quem tem qualquer um dos dois também tem `inventory:view`
  // no seed padrão, e é só uma leitura, sem efeito colateral.
  @Get("check-duplicate")
  checkDuplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CheckDuplicateInventoryQueryDto,
  ) {
    return this.inventoryService.checkDuplicate(user, query);
  }

  // Precisa vir antes de `:id` - senão "pending-approvals" seria interpretado como um id.
  // Gate por `assessments:approve` (não `inventory:manage`) - sobrescreve o `inventory:view` de
  // classe: só quem decide etapas de aprovação enxerga a fila, mesmo permissão reaproveitada do
  // workflow de Assessment (decisão de escopo - ver docs/changelog/2026-08.md).
  @RequirePermissions(PERMISSIONS.ASSESSMENTS_APPROVE)
  @Get("pending-approvals")
  listPendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.listPendingApprovals(user);
  }

  // Precisa vir antes de `:id` - senão "enrichment" seria interpretado como um id.
  // Gate por `inventory:manage` (sobrescreve o `inventory:view` de classe) - só usado no formulário
  // de edição de item, que já exige essa permissão.
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Get("enrichment/eol-products")
  searchEolProducts(@Query() query: SearchEolProductsQueryDto) {
    return this.inventoryService.searchEolProducts(query.search);
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

  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Patch(":id/eol-link")
  linkEolProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: LinkEolProductDto,
  ) {
    return this.inventoryService.linkEolProduct(user, id, dto.eolProductId ?? null);
  }

  // Sem @Audit() decorator - metadata (fonte, veredito) roda explícito no
  // service. Throttle mesmo limite de login/2FA - defesa em profundidade
  // sobre o orçamento diário (ReputationBudgetRepository), que é o
  // enforcement real, não este decorator sozinho.
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":id/reputation-check")
  checkReputation(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.inventoryService.checkReputation(user, id);
  }

  // Sem @Audit() decorator - metadata (IP, contagem de vulns) roda explícito
  // no service, mesmo padrão de reputation-check. Throttle mesmo limite de
  // login/2FA/reputation-check - defesa em profundidade (a InternetDB não
  // tem orçamento diário rígido pra este endpoint enforçar, ver plano).
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(":id/exposure-check")
  checkExposure(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.inventoryService.checkExposure(user, id);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Patch(":id/reputation-declared-known")
  setReputationDeclaredKnown(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SetReputationDeclaredKnownDto,
  ) {
    return this.inventoryService.setReputationDeclaredKnown(user, id, dto.declaredKnown);
  }

  // Sem @Audit() decorator nas 3 rotas abaixo - metadata (motivo da reprovação,
  // notas, evento) roda explícito no service, mesmo padrão de decideStep/changeOwnPassword.
  @RequirePermissions(PERMISSIONS.ASSESSMENTS_APPROVE)
  @Post(":id/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApproveInventoryApprovalDto,
  ) {
    return this.inventoryService.approve(user, id, dto);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_APPROVE)
  @Post(":id/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RejectInventoryApprovalDto,
  ) {
    return this.inventoryService.reject(user, id, dto);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  @Post(":id/resubmit")
  resubmit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.inventoryService.resubmit(user, id);
  }
}
