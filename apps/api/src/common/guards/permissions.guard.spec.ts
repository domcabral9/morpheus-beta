import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("permite quando a rota não exige nenhuma permissão", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it("permite quando o usuário tem todas as permissões exigidas", () => {
    const reflector = {
      getAllAndOverride: () => ["assessments:create", "assessments:submit"],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const user: AuthenticatedUser = {
      id: "u1",
      tenantId: "t1",
      email: "a@b.com",
      name: "A",
      permissions: ["assessments:create", "assessments:submit", "inventory:view"],
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it("bloqueia quando falta alguma permissão exigida", () => {
    const reflector = {
      getAllAndOverride: () => ["assessments:approve"],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const user: AuthenticatedUser = {
      id: "u1",
      tenantId: "t1",
      email: "a@b.com",
      name: "A",
      permissions: ["assessments:create"],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
  });
});
