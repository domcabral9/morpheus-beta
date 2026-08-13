import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { RolesService } from "../roles/roles.service";
import { AuditLogService } from "../audit/audit-log.service";
import { PasswordPolicyService } from "../platform-policy/password-policy.service";
import { TwoFactorPolicyService } from "../platform-policy/two-factor-policy.service";
import { TwoFactorService } from "../two-factor/two-factor.service";
import { NotificationsService } from "../notifications/notifications.service";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage.interface";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { UsersRepository, UserWithPermissions, UserAdminRaw } from "./users.repository";
import { CreateUserDto } from "./dto/create-user.dto";

const PASSWORD_HASH_COST = 12;

const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export interface OwnProfile {
  id: string;
  name: string;
  email: string;
  hasAvatar: boolean;
  hasLocalPassword: boolean;
  hasTwoFactorEnabled: boolean;
  twoFactorEnforced: boolean;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface OwnAvatar {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesService: RolesService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly twoFactorPolicyService: TwoFactorPolicyService,
    private readonly twoFactorService: TwoFactorService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
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
   * na hora (sem senha local - o acesso continua sendo só via SSO). Evita
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
   * Sem senha local aqui de propósito: criação e definição de senha são
   * ações desacopladas (ver `setPassword`) - um usuário criado por aqui só
   * consegue entrar via SSO até alguém chamar `POST :id/password` para ele
   * (ou até uma futura virada para convite por e-mail, sem precisar
   * rearquitetar esta rota).
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

  /**
   * Define/redefine a senha local de um usuário (admin agindo sobre um
   * terceiro) - mesma rota tanto para dar a primeira senha de um usuário
   * recém-criado quanto para resetar a de um usuário já existente/trancado
   * fora, sem fluxo de e-mail/token (item deferido do backlog).
   */
  async setPassword(
    tenantId: string,
    actingUserId: string,
    id: string,
    rawPassword: string,
  ): Promise<UserAdminRaw> {
    await this.assertUserInTenant(tenantId, id);
    await this.passwordPolicyService.validate(rawPassword);
    const passwordHash = await bcrypt.hash(rawPassword, PASSWORD_HASH_COST);
    await this.usersRepository.setPasswordHash(id, passwordHash);

    await this.auditLogService.record({
      tenantId,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      metadata: { passwordChange: true, initiatedBy: "admin" },
    });

    return this.assertUserInTenant(tenantId, id);
  }

  /**
   * Recuperação de conta: remove o 2FA de um terceiro sem exigir a senha
   * atual dele (ao contrário de `TwoFactorService.disable`, autoatendimento)
   * - existe especificamente para o caso de um usuário travado fora por ter
   * perdido a senha E os códigos de backup ao mesmo tempo, quando resetar só
   * a senha (`setPassword` acima) não basta, porque o login ainda exige
   * passar pelo desafio de 2FA. Bloqueia alvo = ator: um admin não pode usar
   * esta rota pra desativar o próprio 2FA sem senha - contornaria a
   * reautenticação que `disable()` exige de propósito.
   */
  async forceDisableTwoFactor(
    tenantId: string,
    actingUserId: string,
    id: string,
  ): Promise<UserAdminRaw> {
    if (id === actingUserId) {
      throw new BadRequestException("Use a opção em Meu perfil para desativar o próprio 2FA.");
    }

    const target = await this.assertUserInTenant(tenantId, id);
    if (!target.totpEnabled) {
      throw new BadRequestException("2FA não está ativo para este usuário.");
    }

    await this.twoFactorService.forceDisable(id);

    await this.auditLogService.record({
      tenantId,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      metadata: { field: "twoFactor", event: "disabled", initiatedBy: "admin" },
    });

    await this.notificationsService.sendRawEmail({
      to: target.email,
      subject: "Verificação em duas etapas desativada por um administrador",
      html:
        `<p>A verificação em duas etapas (2FA) da sua conta na Morpheus foi desativada por um ` +
        `administrador da sua organização, como parte de uma recuperação de acesso.</p>` +
        `<p>Se você não solicitou isso, entre em contato com o time de segurança da sua ` +
        `organização imediatamente.</p>`,
    });

    return this.assertUserInTenant(tenantId, id);
  }

  /** Autoatendimento - troca a própria senha, exige confirmar a atual. */
  async changeOwnPassword(
    actor: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepository.findById(actor.id);
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    if (!user.passwordHash) {
      throw new BadRequestException("Este usuário não tem senha local; o acesso é só via SSO.");
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Senha atual incorreta.");
    }

    await this.passwordPolicyService.validate(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);
    await this.usersRepository.setPasswordHash(actor.id, passwordHash);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { passwordChange: true, initiatedBy: "self" },
    });
  }

  // --- Autoatendimento (perfil) --------------------------------------------------
  async getOwnProfile(actor: AuthenticatedUser): Promise<OwnProfile> {
    const [raw, twoFactorPolicy] = await Promise.all([
      this.findOwnProfileOrThrow(actor.id),
      this.twoFactorPolicyService.getPolicy(),
    ]);
    return this.mapOwnProfile(raw, twoFactorPolicy.enforced);
  }

  /** Autoatendimento - só o nome é editável aqui; email é a chave de login
   * (única por tenant) e fica de fora de propósito, sem fluxo de verificação. */
  async updateOwnProfile(actor: AuthenticatedUser, name: string): Promise<OwnProfile> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException("Nome não pode ser vazio.");
    }
    await this.usersRepository.updateName(actor.id, trimmed);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { field: "name", initiatedBy: "self" },
    });

    return this.getOwnProfile(actor);
  }

  async uploadOwnAvatar(actor: AuthenticatedUser, file: Express.Multer.File): Promise<OwnProfile> {
    const extension = AVATAR_MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException("Formato de imagem não suportado. Envie PNG ou JPEG.");
    }
    const key = `user-avatars/${actor.id}/avatar.${extension}`;
    await this.storage.save(key, file.buffer);
    await this.usersRepository.setAvatarPath(actor.id, key);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { field: "avatar", initiatedBy: "self" },
    });

    return this.getOwnProfile(actor);
  }

  /** Chamado por EmailVerificationService (módulo `auth`) após confirmar um
   * código válido - passthrough deliberado, não repete a auditoria (quem
   * chama já audita a própria operação de verificação). `UsersRepository`
   * fica privado a este módulo (só `UsersService` é exportado por
   * `UsersModule`), então mutações vindas de fora entram por aqui. */
  async markEmailVerified(userId: string): Promise<void> {
    await this.usersRepository.markEmailVerified(userId);
  }

  async getOwnAvatar(actor: AuthenticatedUser): Promise<OwnAvatar> {
    const profile = await this.findOwnProfileOrThrow(actor.id);
    if (!profile.avatarPath) {
      throw new NotFoundException("Você ainda não enviou uma foto de perfil.");
    }
    const extension = profile.avatarPath.split(".").pop();
    const contentType = extension === "jpg" ? "image/jpeg" : "image/png";
    const buffer = await this.storage.read(profile.avatarPath);
    return { buffer, contentType };
  }

  /**
   * Avatar de um TERCEIRO do mesmo tenant (solicitante, aprovador, quem
   * realizou uma ART, etc.) - qualquer usuário autenticado pode ver, sem
   * `users:manage`, já que essas pessoas já aparecem por nome em várias
   * telas que qualquer usuário comum acessa (aprovações, avaliações,
   * fornecedores). Isolamento por tenant vem do `where` da query
   * (`findAvatarPath`), não de uma checagem posterior.
   */
  async getAvatarForUser(tenantId: string, id: string): Promise<OwnAvatar> {
    const record = await this.usersRepository.findAvatarPath(tenantId, id);
    if (!record || !record.avatarPath) {
      throw new NotFoundException("Usuário não encontrado ou sem foto de perfil.");
    }
    const extension = record.avatarPath.split(".").pop();
    const contentType = extension === "jpg" ? "image/jpeg" : "image/png";
    const buffer = await this.storage.read(record.avatarPath);
    return { buffer, contentType };
  }

  private async findOwnProfileOrThrow(id: string) {
    const profile = await this.usersRepository.findOwnProfile(id);
    if (!profile) throw new NotFoundException("Usuário não encontrado.");
    return profile;
  }

  private mapOwnProfile(
    raw: Awaited<ReturnType<UsersRepository["findOwnProfile"]>>,
    twoFactorEnforced: boolean,
  ): OwnProfile {
    if (!raw) throw new NotFoundException("Usuário não encontrado.");
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      hasAvatar: raw.avatarPath !== null,
      hasLocalPassword: raw.passwordHash !== null,
      hasTwoFactorEnabled: raw.totpEnabled,
      twoFactorEnforced,
      emailVerified: raw.emailVerified,
      emailVerifiedAt: raw.emailVerifiedAt,
      roles: raw.userRoles.map((link) => link.role.name),
      lastLoginAt: raw.lastLoginAt,
      createdAt: raw.createdAt,
    };
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
