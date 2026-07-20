import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const userPermissions = new Set(request.user?.permissions ?? []);
    const hasAll = required.every((permission) => userPermissions.has(permission));

    if (!hasAll) {
      throw new ForbiddenException(`Permissão insuficiente. Necessário: ${required.join(", ")}.`);
    }
    return true;
  }
}
