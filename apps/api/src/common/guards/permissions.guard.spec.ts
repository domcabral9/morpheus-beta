import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { PERMISSIONS_ANY_KEY } from "../decorators/require-any-permission.decorator";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/** Mock que distingue @RequirePermissions() de @RequireAnyPermission() pela
 * chave de metadata - o mock ingênuo de um valor único não serve para testar
 * os dois decorators isoladamente, já que o guard consulta as duas chaves. */
function makeKeyedReflector(byKey: Partial<Record<string, string[]>>): Reflector {
  return {
    getAllAndOverride: (key: string) => byKey[key],
  } as unknown as Reflector;
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

  it("permite quando o usuário tem qualquer uma das permissões de RequireAnyPermission", () => {
    const reflector = makeKeyedReflector({
      [PERMISSIONS_ANY_KEY]: ["workflows:manage", "users:manage"],
    });
    const guard = new PermissionsGuard(reflector);
    const user: AuthenticatedUser = {
      id: "u1",
      tenantId: "t1",
      email: "a@b.com",
      name: "A",
      permissions: ["users:manage"],
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it("bloqueia quando falta todas as permissões de RequireAnyPermission", () => {
    const reflector = makeKeyedReflector({
      [PERMISSIONS_ANY_KEY]: ["workflows:manage", "users:manage"],
    });
    const guard = new PermissionsGuard(reflector);
    const user: AuthenticatedUser = {
      id: "u1",
      tenantId: "t1",
      email: "a@b.com",
      name: "A",
      permissions: ["inventory:view"],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
  });

  it("exige as duas checagens quando RequirePermissions e RequireAnyPermission coexistem", () => {
    const reflector = makeKeyedReflector({
      [PERMISSIONS_KEY]: ["assessments:create"],
      [PERMISSIONS_ANY_KEY]: ["workflows:manage", "users:manage"],
    });
    const guard = new PermissionsGuard(reflector);
    const missingAny: AuthenticatedUser = {
      id: "u1",
      tenantId: "t1",
      email: "a@b.com",
      name: "A",
      permissions: ["assessments:create"],
    };
    expect(() => guard.canActivate(makeContext(missingAny))).toThrow(ForbiddenException);

    const hasBoth: AuthenticatedUser = {
      id: "u2",
      tenantId: "t1",
      email: "b@b.com",
      name: "B",
      permissions: ["assessments:create", "users:manage"],
    };
    expect(guard.canActivate(makeContext(hasBoth))).toBe(true);
  });
});
