import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuditAction } from "@morpheus/database";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "./audit-log.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs.query.dto";

@ApiTags("audit")
@RequirePermissions(PERMISSIONS.AUDIT_VIEW)
@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const { items, total } = await this.auditLogService.list(
      {
        tenantId: user.tenantId,
        entityType: query.entityType,
        entityId: query.entityId,
        userId: query.userId,
        action: query.action as AuditAction | undefined,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      page,
      pageSize,
    );

    return { items, total, page, pageSize };
  }
}
