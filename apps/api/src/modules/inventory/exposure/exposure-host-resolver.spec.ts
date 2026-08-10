import { promises as dns } from "node:dns";
import { ExposureHostResolver, isPrivateOrReservedIpv4 } from "./exposure-host-resolver";

jest.mock("node:dns", () => ({ promises: { lookup: jest.fn() } }));

describe("isPrivateOrReservedIpv4", () => {
  it.each([
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["9.255.255.255", false],
    ["11.0.0.1", false],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.15.255.255", false],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["192.169.0.1", false],
    ["127.0.0.1", true],
    // Endpoint de metadados de nuvem - caso de teste explícito (decisão do plano).
    ["169.254.169.254", true],
    ["100.64.0.1", true],
    ["100.127.255.255", true],
    ["100.128.0.1", false],
    ["0.1.2.3", true],
    ["224.0.0.1", true],
    ["240.0.0.1", true],
    ["255.255.255.255", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["not-an-ip", true],
    ["999.1.1.1", true],
  ])("isPrivateOrReservedIpv4(%s) === %s", (ip, expected) => {
    expect(isPrivateOrReservedIpv4(ip)).toBe(expected);
  });
});

describe("ExposureHostResolver", () => {
  let resolver: ExposureHostResolver;
  const lookupMock = dns.lookup as jest.Mock;

  beforeEach(() => {
    resolver = new ExposureHostResolver();
    lookupMock.mockReset();
  });

  it("resolve um IP público a partir de uma URL completa", async () => {
    lookupMock.mockResolvedValue({ address: "8.8.8.8", family: 4 });
    const ip = await resolver.resolvePublicIpv4("https://api.exemplo.com/health");
    expect(ip).toBe("8.8.8.8");
    expect(lookupMock).toHaveBeenCalledWith("api.exemplo.com", { family: 4 });
  });

  it("tolera URL sem protocolo, tentando https por padrão", async () => {
    lookupMock.mockResolvedValue({ address: "8.8.8.8", family: 4 });
    const ip = await resolver.resolvePublicIpv4("api.exemplo.com/health");
    expect(ip).toBe("8.8.8.8");
    expect(lookupMock).toHaveBeenCalledWith("api.exemplo.com", { family: 4 });
  });

  it("devolve null sem chamar o DNS quando a URL não é parseável de jeito nenhum", async () => {
    const ip = await resolver.resolvePublicIpv4("::::");
    expect(ip).toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("devolve null quando o IP resolvido é privado/reservado (nunca manda pra InternetDB)", async () => {
    lookupMock.mockResolvedValue({ address: "169.254.169.254", family: 4 });
    const ip = await resolver.resolvePublicIpv4("http://metadata.internal/latest");
    expect(ip).toBeNull();
  });

  it("devolve null quando a resolução DNS falha", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    const ip = await resolver.resolvePublicIpv4("https://host-inexistente.invalid");
    expect(ip).toBeNull();
  });
});
