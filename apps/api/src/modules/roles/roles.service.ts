import { Injectable } from "@nestjs/common";
import { RolesRepository, RoleSummary } from "./roles.repository";

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  findAll(tenantId: string): Promise<RoleSummary[]> {
    return this.rolesRepository.findAllForTenant(tenantId);
  }
}
