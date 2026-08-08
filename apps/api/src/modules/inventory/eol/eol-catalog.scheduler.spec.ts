import { Test } from "@nestjs/testing";
import { EolCatalogScheduler } from "./eol-catalog.scheduler";
import { EolCatalogClient } from "./eol-catalog.client";
import { EolCatalogRepository } from "./eol-catalog.repository";

describe("EolCatalogScheduler", () => {
  let scheduler: EolCatalogScheduler;
  let client: { listProducts: jest.Mock; fetchProductDetail: jest.Mock };
  let repo: { upsertOne: jest.Mock };

  beforeEach(async () => {
    client = { listProducts: jest.fn(), fetchProductDetail: jest.fn() };
    repo = { upsertOne: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EolCatalogScheduler,
        { provide: EolCatalogClient, useValue: client },
        { provide: EolCatalogRepository, useValue: repo },
      ],
    }).compile();

    scheduler = moduleRef.get(EolCatalogScheduler);
  });

  it("não tenta buscar detalhes quando a lista de produtos vem vazia (desabilitado ou falha)", async () => {
    client.listProducts.mockResolvedValue([]);
    await scheduler.syncCatalog();
    expect(client.fetchProductDetail).not.toHaveBeenCalled();
    expect(repo.upsertOne).not.toHaveBeenCalled();
  });

  it("sincroniza cada produto individualmente, gravando assim que cada detalhe chega", async () => {
    client.listProducts.mockResolvedValue([
      { slug: "python", name: "Python" },
      { slug: "nodejs", name: "Node.js" },
    ]);
    client.fetchProductDetail
      .mockResolvedValueOnce({ slug: "python", name: "Python", releases: [{ name: "3.14" }] })
      .mockResolvedValueOnce({ slug: "nodejs", name: "Node.js", releases: [{ name: "22" }] });

    await scheduler.syncCatalog();

    expect(repo.upsertOne).toHaveBeenCalledTimes(2);
    expect(repo.upsertOne).toHaveBeenNthCalledWith(1, "python", "Python", [{ name: "3.14" }]);
    expect(repo.upsertOne).toHaveBeenNthCalledWith(2, "nodejs", "Node.js", [{ name: "22" }]);
  });

  it("pula produtos cujo detalhe falhou, sem abortar o resto da sincronização", async () => {
    client.listProducts.mockResolvedValue([
      { slug: "quebrado", name: "Quebrado" },
      { slug: "python", name: "Python" },
    ]);
    client.fetchProductDetail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ slug: "python", name: "Python", releases: [] });

    await scheduler.syncCatalog();

    expect(repo.upsertOne).toHaveBeenCalledTimes(1);
    expect(repo.upsertOne).toHaveBeenCalledWith("python", "Python", []);
  });
});
