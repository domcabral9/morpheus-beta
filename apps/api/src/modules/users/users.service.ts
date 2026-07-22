import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RolesService } from "../roles/roles.service";
import { UsersRepository, UserWithPermissions, UserAdminRaw } from "./users.repository";
import { CreateUserDto } from "./dto/create-user.dto";

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

  /**
   * Sem senha local aqui de propósito: como o login por senha não tem fluxo
   * de "definir senha" implementado, um usuário criado por aqui só consegue
   * entrar via SSO (mesmo padrão de findOrProvisionBySso) até um incremento
   * futuro cobrir esse caso.
   */
  async create(tenantId: string, dto: CreateUserDto): Promise<UserAdminRaw> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersRepository.findByEmail(tenantId, email);
    if (existing) {
      throw new BadRequestException("E-mail já cadastrado neste tenant.");
    }

    // "Replicar papéis" é uma alternativa à lista manual, não um complemento
    // - se vier um usuário de referência, os papéis dele que valem.
    let roleIds: string[];
    if (dto.replicateRolesFromUserId) {
      const source = await this.assertUserInTenant(tenantId, dto.replicateRolesFromUserId);
      roleIds = source.userRoles.map((link) => link.role.id);
    } else {
      roleIds = [...new Set(dto.roleIds ?? [])];
    }

    for (const roleId of roleIds) {
      await this.assertRoleInTenant(tenantId, roleId);
    }

    const created = await this.usersRepository.create({ tenantId, name: dto.name, email });
    for (const roleId of roleIds) {
      await this.usersRepository.assignRole(created.id, roleId);
    }

    return this.assertUserInTenant(tenantId, created.id);
  }

  async setActive(
    tenantId: string,
    actingUserId: string,
    id: string,
    isActive: boolean,
  ): Promise<UserAdminRaw> {
    if (id === actingUserId && !isActive) {
      throw new BadRequestException("Você não pode desativar a própria conta.");
    }
    await this.assertUserInTenant(tenantId, id);
    await this.usersRepository.setActive(id, isActive);
    return this.assertUserInTenant(tenantId, id);
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
