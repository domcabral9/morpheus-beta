import { Module } from "@nestjs/common";
import { RolesModule } from "../roles/roles.module";
import { PlatformPolicyModule } from "../platform-policy/platform-policy.module";
import { StorageModule } from "../storage/storage.module";
import { TwoFactorModule } from "../two-factor/two-factor.module";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [RolesModule, PlatformPolicyModule, StorageModule, TwoFactorModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
