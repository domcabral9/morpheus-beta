import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Tenant } from "@morpheus/database";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage.interface";
import { TenantPublicSummary, TenantsRepository, TenantSummary } from "./tenants.repository";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

const LOGO_MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export interface TenantLogo {
  buffer: Buffer;
  contentType: string;
}

/** `logoUrl` começando com "/" é um caminho estático do Next.js (seed de demo) —
 * não passa pelo StorageAdapter. Reaproveitado por `TechnicalOpinionService`
 * para decidir se vale a pena tentar embutir o logo no PDF gerado. */
export function isStorageBackedLogo(logoUrl: string): boolean {
  return !logoUrl.startsWith("/");
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

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

  async uploadLogo(tenantId: string, file: Express.Multer.File): Promise<Tenant> {
    await this.getCurrent(tenantId);
    const extension = LOGO_MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException("Formato de imagem não suportado. Envie PNG ou JPEG.");
    }
    const key = `tenant-logos/${tenantId}/logo.${extension}`;
    await this.storage.save(key, file.buffer);
    return this.tenantsRepository.update(tenantId, { logoUrl: key });
  }

  async getLogo(tenantId: string): Promise<TenantLogo> {
    const tenant = await this.getCurrent(tenantId);
    if (!tenant.logoUrl || !isStorageBackedLogo(tenant.logoUrl)) {
      throw new NotFoundException("Este tenant não tem um logo enviado.");
    }
    const extension = tenant.logoUrl.split(".").pop();
    const contentType = extension === "jpg" ? "image/jpeg" : "image/png";
    const buffer = await this.storage.read(tenant.logoUrl);
    return { buffer, contentType };
  }
}
