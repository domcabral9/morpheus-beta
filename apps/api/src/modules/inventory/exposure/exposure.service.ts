import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { AuditLogService } from "../../audit/audit-log.service";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository, InventoryItemDetail } from "../inventory.repository";
import { ExposureHostResolver } from "./exposure-host-resolver";
import { InternetDbClient } from "./internetdb.client";

/**
 * Checagem de exposição externa (Shodan InternetDB). Diferente da
 * reputação, "verificado sem dado" é um resultado terminal válido, não um
 * erro: se a URL não resolve pra um IP público, o IP resolvido é privado/
 * reservado, ou a InternetDB devolve 404, o item ainda assim tem
 * `exposureLastCheckedAt` atualizado com `exposureRawData` nulo - evita que
 * a varredura noturna tente resolver o mesmo host quebrado todo dia pra
 * sempre. Só a ausência total de `url` no item lança erro sem persistir
 * nada (mesmo tratamento do "sem artefato" da reputação). `actingUserId` é
 * `null` quando chamado pela varredura noturna (ExposureSweepScheduler),
 * mesmo padrão de auditoria "sem usuário" já usado pelos outros schedulers.
 */
@Injectable()
export class ExposureService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly hostResolver: ExposureHostResolver,
    private readonly internetDbClient: InternetDbClient,
    private readonly integrationsPolicyService: IntegrationsPolicyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async performCheck(
    item: InventoryItemDetail,
    actingUserId: string | null,
  ): Promise<InventoryItemDetail> {
    if (!item.url) {
      throw new BadRequestException("Item sem URL cadastrada para checar exposição externa.");
    }

    const policy = await this.integrationsPolicyService.getPolicy();
    if (!policy.internetDbEnabled) {
      throw new BadRequestException("Integração com a Shodan InternetDB está desabilitada.");
    }

    const ip = await this.hostResolver.resolvePublicIpv4(item.url);
    const rawData = ip ? await this.internetDbClient.lookup(ip) : null;

    const updated = await this.repository.update(item.id, {
      exposureLastCheckedAt: new Date(),
      exposureCheckedIp: ip,
      exposureRawData: rawData ? (rawData as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    });

    // Metadata nunca inclui o payload bruto (portas/tags/CPEs) - só o IP
    // (baixa sensibilidade, já deriva de `url`, visível a qualquer usuário
    // com inventory:view) e a contagem de vulnerabilidades.
    await this.auditLogService.record({
      tenantId: item.tenantId,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "SoftwareInventoryItem",
      entityId: item.id,
      metadata: { field: "exposure", ip, vulnCount: rawData?.vulns.length ?? 0 },
    });

    return updated;
  }
}
