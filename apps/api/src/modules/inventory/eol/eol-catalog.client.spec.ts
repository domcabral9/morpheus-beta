import { Test } from "@nestjs/testing";
import { EolCatalogClient } from "./eol-catalog.client";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("EolCatalogClient", () => {
  let client: EolCatalogClient;
  let integrationsPolicyService: { getPolicy: jest.Mock };

  beforeEach(async () => {
    integrationsPolicyService = { getPolicy: jest.fn() };
    global.fetch = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EolCatalogClient,
        { provide: IntegrationsPolicyService, useValue: integrationsPolicyService },
      ],
    }).compile();

    client = moduleRef.get(EolCatalogClient);
  });

  describe("listProducts", () => {
    it("devolve vazio sem chamar a API quando endoflifeEnabled é false", async () => {
      integrationsPolicyService.getPolicy.mockResolvedValue({ endoflifeEnabled: false });
      const result = await client.listProducts();
      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("mapeia name/label da API pra slug/name", async () => {
      integrationsPolicyService.getPolicy.mockResolvedValue({ endoflifeEnabled: true });
      mockFetchOnce(200, { result: [{ name: "python", label: "Python" }] });

      const result = await client.listProducts();
      expect(result).toEqual([{ slug: "python", name: "Python" }]);
    });

    it("devolve vazio (não lança) quando a API responde erro", async () => {
      integrationsPolicyService.getPolicy.mockResolvedValue({ endoflifeEnabled: true });
      mockFetchOnce(500, {});
      expect(await client.listProducts()).toEqual([]);
    });

    it("devolve vazio (não lança) quando o fetch rejeita", async () => {
      integrationsPolicyService.getPolicy.mockResolvedValue({ endoflifeEnabled: true });
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
      expect(await client.listProducts()).toEqual([]);
    });
  });

  describe("fetchProductDetail", () => {
    it("devolve slug/name/releases em caso de sucesso", async () => {
      mockFetchOnce(200, {
        result: { name: "python", label: "Python", releases: [{ name: "3.14" }] },
      });
      const result = await client.fetchProductDetail("python");
      expect(result).toEqual({ slug: "python", name: "Python", releases: [{ name: "3.14" }] });
    });

    it("devolve null (não lança) em 404", async () => {
      mockFetchOnce(404, {});
      expect(await client.fetchProductDetail("inexistente")).toBeNull();
    });
  });
});
