import { Test } from "@nestjs/testing";
import { SearchService } from "./search.service";
import { SearchRepository } from "./search.repository";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "a@b.com",
    name: "A",
    permissions: [],
    isSuperAdmin: false,
    ...overrides,
  };
}

describe("SearchService", () => {
  let service: SearchService;
  let repo: {
    searchAssessments: jest.Mock;
    searchInventoryItems: jest.Mock;
    searchTechnicalOpinions: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      searchAssessments: jest.fn().mockResolvedValue([]),
      searchInventoryItems: jest.fn().mockResolvedValue([]),
      searchTechnicalOpinions: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [SearchService, { provide: SearchRepository, useValue: repo }],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it("sem nenhuma permissão relevante, não consulta avaliações nem inventário", async () => {
    await service.search(makeUser({ permissions: [] }), "contract");

    expect(repo.searchAssessments).not.toHaveBeenCalled();
    expect(repo.searchInventoryItems).not.toHaveBeenCalled();
    // pareceres seguem a mesma regra do TechnicalOpinionService: sempre consulta,
    // só escopado por requesterId (pode voltar vazio se o usuário nunca solicitou nada)
    expect(repo.searchTechnicalOpinions).toHaveBeenCalledWith("tenant-1", "user-1", "contract", 5);
  });

  it("com assessments:view-own, busca só as próprias avaliações", async () => {
    await service.search(makeUser({ permissions: ["assessments:view-own"] }), "contract");

    expect(repo.searchAssessments).toHaveBeenCalledWith("tenant-1", "user-1", "contract", 5);
  });

  it("com assessments:view-all, busca avaliações e pareceres do tenant inteiro", async () => {
    await service.search(makeUser({ permissions: ["assessments:view-all"] }), "contract");

    expect(repo.searchAssessments).toHaveBeenCalledWith("tenant-1", undefined, "contract", 5);
    expect(repo.searchTechnicalOpinions).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      "contract",
      5,
    );
  });

  it("com assessments:approve (sem view-all), pareceres também ficam sem escopo de requester", async () => {
    await service.search(makeUser({ permissions: ["assessments:approve"] }), "contract");

    expect(repo.searchTechnicalOpinions).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      "contract",
      5,
    );
  });

  it("com inventory:view, busca itens de inventário", async () => {
    await service.search(makeUser({ permissions: ["inventory:view"] }), "api");

    expect(repo.searchInventoryItems).toHaveBeenCalledWith("tenant-1", "api", 5);
  });

  it("formata os resultados pra shape plano esperado pela paleta", async () => {
    repo.searchAssessments.mockResolvedValue([
      {
        id: "a1",
        softwareName: "Contract Analyzer",
        status: "IN_REVIEW",
        area: { name: "Jurídico" },
        updatedAt: new Date("2026-01-01"),
      },
    ]);
    repo.searchInventoryItems.mockResolvedValue([
      { id: "i1", name: "Freight API", status: "ACTIVE", area: { name: "Operações" } },
    ]);
    repo.searchTechnicalOpinions.mockResolvedValue([
      {
        id: "t1",
        number: "2026-000123",
        classificationLabel: "Homologado",
        assessmentVersion: { assessment: { softwareName: "Contract Analyzer" } },
      },
    ]);

    const result = await service.search(
      makeUser({ permissions: ["assessments:view-all", "inventory:view"] }),
      "contract",
    );

    expect(result.assessments).toEqual([
      {
        id: "a1",
        softwareName: "Contract Analyzer",
        status: "IN_REVIEW",
        areaName: "Jurídico",
        updatedAt: new Date("2026-01-01"),
      },
    ]);
    expect(result.inventoryItems).toEqual([
      { id: "i1", name: "Freight API", status: "ACTIVE", areaName: "Operações" },
    ]);
    expect(result.technicalOpinions).toEqual([
      {
        id: "t1",
        number: "2026-000123",
        classificationLabel: "Homologado",
        softwareName: "Contract Analyzer",
      },
    ]);
  });
});
