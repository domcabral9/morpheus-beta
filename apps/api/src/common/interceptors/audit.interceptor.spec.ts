import { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of, firstValueFrom } from "rxjs";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditLogService } from "../../modules/audit/audit-log.service";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import type { AuditMetadata } from "../decorators/audit.decorator";

const user: AuthenticatedUser = {
  id: "user-1",
  tenantId: "tenant-1",
  homeTenantId: "tenant-1",
  email: "a@b.com",
  name: "A",
  permissions: [],
  isSuperAdmin: false,
};

function makeContext(params: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params,
        ip: "127.0.0.1",
        headers: { "user-agent": "jest" },
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeHandler(responseBody: unknown): CallHandler {
  return { handle: () => of(responseBody) };
}

describe("AuditInterceptor", () => {
  let auditLogService: { record: jest.Mock };

  beforeEach(() => {
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
  });

  function makeInterceptor(metadata: AuditMetadata | undefined) {
    const reflector = { getAllAndOverride: () => metadata } as unknown as Reflector;
    return new AuditInterceptor(reflector, auditLogService as unknown as AuditLogService);
  }

  it("não grava nada quando a rota não tem @Audit()", async () => {
    const interceptor = makeInterceptor(undefined);
    const result = await firstValueFrom(
      interceptor.intercept(makeContext(), makeHandler({ id: "x" })),
    );
    expect(result).toEqual({ id: "x" });
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("CREATE: prioriza o id do corpo da resposta sobre o param de rota (pai)", async () => {
    const interceptor = makeInterceptor({ action: "CREATE", entityType: "ProbabilityLevel" });
    await firstValueFrom(
      interceptor.intercept(
        makeContext({ id: "config-pai-1" }),
        makeHandler({ id: "level-novo-1" }),
      ),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "level-novo-1", action: "CREATE" }),
    );
  });

  it("UPDATE: usa o param :id da rota", async () => {
    const interceptor = makeInterceptor({ action: "UPDATE", entityType: "RiskMatrixConfig" });
    await firstValueFrom(
      interceptor.intercept(makeContext({ id: "config-1" }), makeHandler({ id: "config-1" })),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "config-1", action: "UPDATE" }),
    );
  });

  it("UPDATE: usa o único param de rota mesmo com outro nome (:levelId)", async () => {
    const interceptor = makeInterceptor({ action: "UPDATE", entityType: "ProbabilityLevel" });
    await firstValueFrom(
      interceptor.intercept(makeContext({ levelId: "level-1" }), makeHandler(undefined)),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "level-1", action: "UPDATE" }),
    );
  });

  it("grava tenantId/userId/ip/userAgent a partir da requisição", async () => {
    const interceptor = makeInterceptor({ action: "DELETE", entityType: "QuestionOption" });
    await firstValueFrom(
      interceptor.intercept(makeContext({ id: "opt-1" }), makeHandler(undefined)),
    );
    expect(auditLogService.record).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "DELETE",
      entityType: "QuestionOption",
      entityId: "opt-1",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
    });
  });
});
