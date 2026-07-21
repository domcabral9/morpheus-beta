import { Injectable } from "@nestjs/common";
import { RolesRepository, RoleSummary, RoleWithTenant } from "./roles.repository";

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  findAll(tenantId: string): Promise<RoleSummary[]> {
    return this.rolesRepository.findAllForTenant(tenantId);
  }

  findById(id: string): Promise<RoleWithTenant | null> {
    return this.rolesRepository.findById(id);
  }
}
