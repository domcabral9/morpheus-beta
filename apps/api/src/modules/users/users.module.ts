import { Module } from "@nestjs/common";
import { RolesModule } from "../roles/roles.module";
import { PasswordPolicyModule } from "../platform-policy/password-policy.module";
import { StorageModule } from "../storage/storage.module";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [RolesModule, PasswordPolicyModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
