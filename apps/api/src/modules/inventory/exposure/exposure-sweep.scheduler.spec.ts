import { Test } from "@nestjs/testing";
import { ExposureSweepScheduler } from "./exposure-sweep.scheduler";
import { ExposureService } from "./exposure.service";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository } from "../inventory.repository";

async function runSweep(scheduler: ExposureSweepScheduler) {
  const promise = scheduler.sweep();
  await jest.runAllTimersAsync();
  await promise;
}

describe("ExposureSweepScheduler", () => {
  let scheduler: ExposureSweepScheduler;
  let repository: { findDueForExposureCheck: jest.Mock };
  let exposureService: { performCheck: jest.Mock };
  let integrationsPolicyService: { getPolicy: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    repository = { findDueForExposureCheck: jest.fn().mockResolvedValue([]) };
    exposureService = { performCheck: jest.fn().mockResolvedValue({}) };
    integrationsPolicyService = {
      getPolicy: jest.fn().mockResolvedValue({ internetDbEnabled: true }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExposureSweepScheduler,
        { provide: InventoryRepository, useValue: repository },
        { provide: ExposureService, useValue: exposureService },
        { provide: IntegrationsPolicyService, useValue: integrationsPolicyService },
      ],
    }).compile();

    scheduler = moduleRef.get(ExposureSweepScheduler);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("não busca itens quando a integração está desabilitada", async () => {
    integrationsPolicyService.getPolicy.mockResolvedValue({ internetDbEnabled: false });
    await runSweep(scheduler);
    expect(repository.findDueForExposureCheck).not.toHaveBeenCalled();
  });

  it("checa cada item elegível", async () => {
    repository.findDueForExposureCheck.mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
    await runSweep(scheduler);
    expect(exposureService.performCheck).toHaveBeenCalledTimes(2);
    expect(exposureService.performCheck).toHaveBeenNthCalledWith(1, { id: "item-1" }, null);
    expect(exposureService.performCheck).toHaveBeenNthCalledWith(2, { id: "item-2" }, null);
  });

  it("pula um item que falhou, sem abortar o resto da varredura (sem orçamento pra estourar aqui)", async () => {
    repository.findDueForExposureCheck.mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
    exposureService.performCheck
      .mockRejectedValueOnce(new Error("falha pontual"))
      .mockResolvedValueOnce({});
    await runSweep(scheduler);
    expect(exposureService.performCheck).toHaveBeenCalledTimes(2);
  });

  it("respeita o teto de itens por execução, mesmo com uma lista maior de itens vencidos", async () => {
    const manyItems = Array.from({ length: 150 }, (_, i) => ({ id: `item-${i}` }));
    repository.findDueForExposureCheck.mockResolvedValue(manyItems);
    await runSweep(scheduler);
    expect(exposureService.performCheck).toHaveBeenCalledTimes(100);
  });
});
