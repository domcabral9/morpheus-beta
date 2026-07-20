import { Injectable } from "@nestjs/common";
import { UsersRepository, UserWithPermissions } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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
}
