import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { PERMISSIONS_ANY_KEY } from "../decorators/require-any-permission.decorator";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAny = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_ANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!required || required.length === 0) && (!requiredAny || requiredAny.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const userPermissions = new Set(request.user?.permissions ?? []);

    if (required && required.length > 0) {
      const hasAll = required.every((permission) => userPermissions.has(permission));
      if (!hasAll) {
        throw new ForbiddenException(`Permissão insuficiente. Necessário: ${required.join(", ")}.`);
      }
    }

    if (requiredAny && requiredAny.length > 0) {
      const hasAny = requiredAny.some((permission) => userPermissions.has(permission));
      if (!hasAny) {
        throw new ForbiddenException(
          `Permissão insuficiente. Necessário uma de: ${requiredAny.join(", ")}.`,
        );
      }
    }

    return true;
  }
}
