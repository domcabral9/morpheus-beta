import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Registrado como guard global (ver app.module.ts, APP_GUARD) — toda rota é
 * protegida por padrão, a não ser que marcada com @Public(). Essa é a
 * inversão deliberada em relação a "aplicar guard rota por rota": esquecer
 * de proteger uma rota nova é o erro mais comum e mais caro em RBAC: aqui
 * ele simplesmente não é possível por omissão.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }
}
