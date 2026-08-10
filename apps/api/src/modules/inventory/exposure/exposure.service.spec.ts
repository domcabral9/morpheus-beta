import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ExposureService } from "./exposure.service";
import { ExposureHostResolver } from "./exposure-host-resolver";
import { InternetDbClient, InternetDbResult } from "./internetdb.client";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository } from "../inventory.repository";
import { AuditLogService } from "../../audit/audit-log.service";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    url: null,
    ...overrides,
  } as never;
}

const RESULT_WITH_VULNS: InternetDbResult = {
  ip: "203.0.113.10",
  ports: [22, 443],
  cpes: ["cpe:/a:openssh:openssh"],
  hostnames: ["host.example"],
  tags: [],
  vulns: ["CVE-2024-99999"],
};

describe("ExposureService", () => {
  let service: ExposureService;
  let repository: { update: jest.Mock };
  let hostResolver: { resolvePublicIpv4: jest.Mock };
  let internetDbClient: { lookup: jest.Mock };
  let integrationsPolicyService: { getPolicy: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repository = {
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    };
    hostResolver = { resolvePublicIpv4: jest.fn().mockResolvedValue("203.0.113.10") };
    internetDbClient = { lookup: jest.fn().mockResolvedValue(RESULT_WITH_VULNS) };
    integrationsPolicyService = {
      getPolicy: jest.fn().mockResolvedValue({ internetDbEnabled: true }),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExposureService,
        { provide: InventoryRepository, useValue: repository },
        { provide: ExposureHostResolver, useValue: hostResolver },
        { provide: InternetDbClient, useValue: internetDbClient },
        { provide: IntegrationsPolicyService, useValue: integrationsPolicyService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(ExposureService);
  });

  it("rejeita item sem URL, sem persistir nada", async () => {
    await expect(service.performCheck(makeItem(), "user-1")).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejeita quando a integração está desabilitada, sem persistir nada", async () => {
    integrationsPolicyService.getPolicy.mockResolvedValue({ internetDbEnabled: false });
    await expect(
      service.performCheck(makeItem({ url: "https://example.com" }), "user-1"),
    ).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("IP privado/reservado resolvido persiste como checagem concluída sem dado, em vez de lançar erro", async () => {
    hostResolver.resolvePublicIpv4.mockResolvedValue(null);
    const updated = await service.performCheck(
      makeItem({ url: "http://169.254.169.254/latest" }),
      "user-1",
    );
    expect(internetDbClient.lookup).not.toHaveBeenCalled();
    expect(updated.exposureCheckedIp).toBeNull();
    expect(repository.update).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ exposureCheckedIp: null }),
    );
  });

  it("404 da InternetDB (host nunca indexado) persiste como checagem concluída sem dado", async () => {
    internetDbClient.lookup.mockResolvedValue(null);
    await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");
    expect(repository.update).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ exposureCheckedIp: "203.0.113.10" }),
    );
  });

  it("sucesso persiste IP + dado bruto e marca exposureLastCheckedAt", async () => {
    await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");
    const [, data] = repository.update.mock.calls[0];
    expect(data.exposureCheckedIp).toBe("203.0.113.10");
    expect(data.exposureLastCheckedAt).toBeInstanceOf(Date);
    expect(data.exposureRawData).toEqual(RESULT_WITH_VULNS);
  });

  it("audita com IP + contagem de vulns, nunca o payload bruto inteiro", async () => {
    await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        metadata: { field: "exposure", ip: "203.0.113.10", vulnCount: 1 },
      }),
    );
    const [[auditCall]] = auditLogService.record.mock.calls;
    expect(JSON.stringify(auditCall.metadata)).not.toMatch(/cpe:|hostnames|host\.example/);
  });

  it("audita com userId null quando chamado pela varredura noturna (sem ator humano)", async () => {
    await service.performCheck(makeItem({ url: "https://example.com" }), null);
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });
});
