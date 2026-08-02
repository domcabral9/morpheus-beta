import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class PreAuthGuard extends AuthGuard("jwt-preauth") {}
