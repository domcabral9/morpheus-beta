import { Test } from "@nestjs/testing";
import { ReputationSweepScheduler } from "./reputation-sweep.scheduler";
import { ReputationService, ReputationBudgetExhaustedException } from "./reputation.service";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository } from "../inventory.repository";

describe("ReputationSweepScheduler", () => {
  let scheduler: ReputationSweepScheduler;
  let repository: { findDueForReputationCheck: jest.Mock };
  let reputationService: { performCheck: jest.Mock };
  let integrationsPolicyService: { getPolicy: jest.Mock };

  beforeEach(async () => {
    repository = { findDueForReputationCheck: jest.fn().mockResolvedValue([]) };
    reputationService = { performCheck: jest.fn() };
    integrationsPolicyService = {
      getPolicy: jest.fn().mockResolvedValue({ virusTotalEnabled: true }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReputationSweepScheduler,
        { provide: InventoryRepository, useValue: repository },
        { provide: ReputationService, useValue: reputationService },
        { provide: IntegrationsPolicyService, useValue: integrationsPolicyService },
      ],
    }).compile();

    scheduler = moduleRef.get(ReputationSweepScheduler);
  });

  it("não busca itens quando a integração está desabilitada", async () => {
    integrationsPolicyService.getPolicy.mockResolvedValue({ virusTotalEnabled: false });
    await scheduler.sweep();
    expect(repository.findDueForReputationCheck).not.toHaveBeenCalled();
  });

  it("checa cada item elegível", async () => {
    repository.findDueForReputationCheck.mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
    reputationService.performCheck.mockResolvedValue({});

    await scheduler.sweep();

    expect(reputationService.performCheck).toHaveBeenCalledTimes(2);
    expect(reputationService.performCheck).toHaveBeenNthCalledWith(1, { id: "item-1" }, null);
    expect(reputationService.performCheck).toHaveBeenNthCalledWith(2, { id: "item-2" }, null);
  });

  it("para cedo assim que o orçamento diário se esgota, sem tentar os itens restantes", async () => {
    repository.findDueForReputationCheck.mockResolvedValue([
      { id: "item-1" },
      { id: "item-2" },
      { id: "item-3" },
    ]);
    reputationService.performCheck
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ReputationBudgetExhaustedException());

    await scheduler.sweep();

    expect(reputationService.performCheck).toHaveBeenCalledTimes(2);
  });

  it("pula um item que falhou por outro motivo, sem abortar o resto da varredura", async () => {
    repository.findDueForReputationCheck.mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
    reputationService.performCheck
      .mockRejectedValueOnce(new Error("falha pontual"))
      .mockResolvedValueOnce({});

    await scheduler.sweep();

    expect(reputationService.performCheck).toHaveBeenCalledTimes(2);
  });
});
