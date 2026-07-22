import { Injectable, NotFoundException } from "@nestjs/common";
import { Tenant } from "@morpheus/database";
import { TenantPublicSummary, TenantsRepository, TenantSummary } from "./tenants.repository";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  listAll(): Promise<TenantSummary[]> {
    return this.tenantsRepository.findAllSummary();
  }

  listAllPublic(): Promise<TenantPublicSummary[]> {
    return this.tenantsRepository.findAllPublicSummary();
  }

  async getCurrent(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findById(tenantId);
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    return tenant;
  }

  async updateCurrent(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.getCurrent(tenantId);
    return this.tenantsRepository.update(tenantId, dto);
  }
}
