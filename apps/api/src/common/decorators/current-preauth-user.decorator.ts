import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { PendingTwoFactorUser } from "../interfaces/pending-two-factor-user.interface";

export const CurrentPreAuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PendingTwoFactorUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: PendingTwoFactorUser }>();
    return request.user;
  },
);
