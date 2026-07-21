import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RolesService } from "../roles/roles.service";
import { UsersRepository, UserWithPermissions, UserAdminRaw } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
  ) {}

  findByEmail(tenantId: string, email: string): Promise<UserWithPermissions | null> {
    return this.usersRepository.findByEmail(tenantId, email.toLowerCase().trim());
  }

  findById(id: string): Promise<UserWithPermissions | null> {
    return this.usersRepository.findById(id);
  }

  /**
   * Provisionamento just-in-time: a primeira vez que um usuário chega via
   * SAML com um NameID que ainda não existe localmente, criamos o registro
   * na hora (sem senha local — o acesso continua sendo só via SSO). Evita
   * exigir que o admin cadastre manualmente todo mundo antes do primeiro
   * login corporativo.
   */
  async findOrProvisionBySso(
    tenantId: string,
    params: { ssoSubject: string; email: string; name: string },
  ): Promise<UserWithPermissions> {
    const existing = await this.usersRepository.findBySsoSubject(tenantId, params.ssoSubject);
    if (existing) return existing;

    const byEmail = await this.usersRepository.findByEmail(tenantId, params.email.toLowerCase());
    if (byEmail) return byEmail;

    await this.usersRepository.create({
      tenantId,
      email: params.email.toLowerCase().trim(),
      name: params.name,
      ssoSubject: params.ssoSubject,
    });

    const created = await this.usersRepository.findBySsoSubject(tenantId, params.ssoSubject);
    if (!created) {
      throw new Error(
        "Falha ao provisionar usuário via SSO: registro não encontrado após criação.",
      );
    }
    return created;
  }

  touchLastLogin(id: string): Promise<void> {
    return this.usersRepository.updateLastLogin(id);
  }

  // --- Administração (users:manage) --------------------------------------------
  listForTenant(tenantId: string): Promise<UserAdminRaw[]> {
    return this.usersRepository.findAllForTenant(tenantId);
  }

  async getForTenant(tenantId: string, id: string): Promise<UserAdminRaw> {
    return this.assertUserInTenant(tenantId, id);
  }

  async assignRole(tenantId: string, userId: string, roleId: string): Promise<UserAdminRaw> {
    await this.assertUserInTenant(tenantId, userId);
    await this.assertRoleInTenant(tenantId, roleId);
    await this.usersRepository.assignRole(userId, roleId);
    return this.assertUserInTenant(tenantId, userId);
  }

  async removeRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    await this.assertUserInTenant(tenantId, userId);
    await this.usersRepository.removeRole(userId, roleId);
  }

  // --- Helpers de tenant scoping ------------------------------------------------
  private async assertUserInTenant(tenantId: string, id: string): Promise<UserAdminRaw> {
    const user = await this.usersRepository.findByIdRaw(id);
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    if (user.tenantId !== tenantId) throw new ForbiddenException("Usuário de outro tenant.");
    return user;
  }

  private async assertRoleInTenant(tenantId: string, id: string): Promise<void> {
    const role = await this.rolesService.findById(id);
    if (!role) throw new NotFoundException("Papel não encontrado.");
    if (role.tenantId !== tenantId) throw new ForbiddenException("Papel de outro tenant.");
  }
}
