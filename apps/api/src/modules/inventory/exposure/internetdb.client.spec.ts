import { InternetDbClient, InternetDbResult } from "./internetdb.client";

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

const SAMPLE_RESULT: InternetDbResult = {
  ip: "8.8.8.8",
  ports: [443, 8080],
  cpes: [],
  hostnames: ["dns.google"],
  tags: ["cloud"],
  vulns: [],
};

describe("InternetDbClient", () => {
  let client: InternetDbClient;

  beforeEach(() => {
    client = new InternetDbClient();
    global.fetch = jest.fn();
  });

  it("devolve o resultado bruto quando o IP está indexado", async () => {
    mockFetchOnce(200, SAMPLE_RESULT);
    expect(await client.lookup("8.8.8.8")).toEqual(SAMPLE_RESULT);
    const [endpoint] = (global.fetch as jest.Mock).mock.calls[0];
    expect(endpoint).toBe("https://internetdb.shodan.io/8.8.8.8");
  });

  it("devolve null (nunca um resultado vazio inventado) quando o IP nunca foi visto pela Shodan (404)", async () => {
    mockFetchOnce(404, {});
    expect(await client.lookup("203.0.113.99")).toBeNull();
  });

  it("devolve null quando a API responde erro genérico", async () => {
    mockFetchOnce(500, {});
    expect(await client.lookup("8.8.8.8")).toBeNull();
  });

  it("devolve null (não lança) quando o fetch rejeita", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    expect(await client.lookup("8.8.8.8")).toBeNull();
  });

  it("não envia nenhum header de autenticação (API sem chave)", async () => {
    mockFetchOnce(200, SAMPLE_RESULT);
    await client.lookup("8.8.8.8");
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options).toBeUndefined();
  });
});
