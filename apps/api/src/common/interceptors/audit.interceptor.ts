import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import { AuditLogService } from "../../modules/audit/audit-log.service";
import { AUDIT_KEY, AuditMetadata } from "../decorators/audit.decorator";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

/**
 * Grava um AuditLog automaticamente para rotas marcadas com `@Audit()` — só
 * um no-op para as demais (metadata ausente).
 *
 * A prioridade de onde tirar o `entityId` depende da ação: em CREATE, o
 * param de rota costuma ser o ID do recurso PAI (ex.:
 * `POST /configs/:id/probability-levels` — `:id` é o config, não a faixa
 * recém-criada), então o corpo da resposta (`.id` da entidade criada) vem
 * primeiro. Em UPDATE/DELETE é o contrário: o param de rota é o próprio
 * recurso alvo (`:id`, ou o único param quando ele tem outro nome — ex.:
 * `:levelId`, `:cellId`), e o corpo pode nem existir (DELETE sem corpo).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    return next.handle().pipe(
      tap((responseBody) => {
        const entityId =
          metadata.action === "CREATE"
            ? (this.extractIdFromBody(responseBody) ?? this.extractIdFromParams(request.params))
            : (this.extractIdFromParams(request.params) ?? this.extractIdFromBody(responseBody));

        void this.auditLogService.record({
          tenantId: request.user?.tenantId ?? null,
          userId: request.user?.id ?? null,
          action: metadata.action,
          entityType: metadata.entityType,
          entityId: entityId ?? null,
          ipAddress: request.ip ?? null,
          userAgent: request.headers["user-agent"] ?? null,
        });
      }),
    );
  }

  private extractIdFromParams(
    params: Record<string, string | string[] | undefined> | undefined,
  ): string | undefined {
    if (!params) return undefined;
    if (typeof params.id === "string") return params.id;
    const values = Object.values(params).filter(
      (value): value is string => typeof value === "string",
    );
    return values.length === 1 ? values[0] : undefined;
  }

  private extractIdFromBody(body: unknown): string | undefined {
    if (body && typeof body === "object" && "id" in body) {
      const id = (body as { id?: unknown }).id;
      return typeof id === "string" ? id : undefined;
    }
    return undefined;
  }
}
