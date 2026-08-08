import { VirusTotalClient } from "./virustotal.client";

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("VirusTotalClient", () => {
  let client: VirusTotalClient;

  beforeEach(() => {
    client = new VirusTotalClient();
    global.fetch = jest.fn();
  });

  describe("checkHash", () => {
    it("devolve CLEAN quando nenhum motor marca malicious/suspicious", async () => {
      mockFetchOnce(200, {
        data: {
          attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 70 } },
        },
      });
      expect(await client.checkHash("abc123", "fake-key")).toBe("CLEAN");
    });

    it("devolve SUSPICIOUS quando algum motor marca malicious", async () => {
      mockFetchOnce(200, {
        data: { attributes: { last_analysis_stats: { malicious: 3, suspicious: 0 } } },
      });
      expect(await client.checkHash("abc123", "fake-key")).toBe("SUSPICIOUS");
    });

    it("devolve SUSPICIOUS quando algum motor marca suspicious (mesmo sem malicious)", async () => {
      mockFetchOnce(200, {
        data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 2 } } },
      });
      expect(await client.checkHash("abc123", "fake-key")).toBe("SUSPICIOUS");
    });

    it("devolve null (nunca CLEAN) quando o hash nunca foi visto pelo VT (404)", async () => {
      mockFetchOnce(404, {});
      expect(await client.checkHash("hash-nunca-visto", "fake-key")).toBeNull();
    });

    it("devolve null quando a API responde erro genérico", async () => {
      mockFetchOnce(500, {});
      expect(await client.checkHash("abc123", "fake-key")).toBeNull();
    });

    it("devolve null (não lança) quando o fetch rejeita", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
      expect(await client.checkHash("abc123", "fake-key")).toBeNull();
    });

    it("envia a chave no header x-apikey", async () => {
      mockFetchOnce(200, { data: { attributes: { last_analysis_stats: { malicious: 0 } } } });
      await client.checkHash("abc123", "minha-chave");
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(options.headers["x-apikey"]).toBe("minha-chave");
    });
  });

  describe("checkUrl", () => {
    it("codifica a URL em base64url sem padding pro id da consulta", async () => {
      mockFetchOnce(200, { data: { attributes: { last_analysis_stats: { malicious: 0 } } } });
      await client.checkUrl("https://example.com", "fake-key");
      const [endpoint] = (global.fetch as jest.Mock).mock.calls[0];
      const expectedId = Buffer.from("https://example.com", "utf8").toString("base64url");
      expect(endpoint).toBe(`https://www.virustotal.com/api/v3/urls/${expectedId}`);
    });

    it("devolve null em 404 (URL nunca vista)", async () => {
      mockFetchOnce(404, {});
      expect(await client.checkUrl("https://nunca-vista.example", "fake-key")).toBeNull();
    });
  });
});
