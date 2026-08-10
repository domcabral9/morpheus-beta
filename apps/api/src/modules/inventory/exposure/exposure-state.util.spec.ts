import { computeExposureState } from "./exposure-state.util";
import type { InternetDbResult } from "./internetdb.client";

const RESULT_WITH_VULNS: InternetDbResult = {
  ip: "8.8.8.8",
  ports: [443],
  cpes: [],
  hostnames: [],
  tags: [],
  vulns: ["CVE-2024-12345"],
};

const RESULT_WITHOUT_VULNS: InternetDbResult = {
  ip: "8.8.8.8",
  ports: [443],
  cpes: [],
  hostnames: [],
  tags: [],
  vulns: [],
};

describe("computeExposureState", () => {
  it("devolve unverified quando nunca foi checado", () => {
    expect(computeExposureState({ exposureLastCheckedAt: null, exposureRawData: null })).toBe(
      "unverified",
    );
  });

  it("devolve unverified quando foi checado mas não há dado (URL sem IP público, IP privado, ou 404 da InternetDB) - nunca vira um veredito positivo", () => {
    expect(
      computeExposureState({ exposureLastCheckedAt: new Date(), exposureRawData: null }),
    ).toBe("unverified");
  });

  it("devolve exposed quando a checagem encontrou vulnerabilidades conhecidas", () => {
    expect(
      computeExposureState({
        exposureLastCheckedAt: new Date(),
        exposureRawData: RESULT_WITH_VULNS,
      }),
    ).toBe("exposed");
  });

  it("devolve no-known-vulnerabilities quando a checagem teve sucesso sem vulnerabilidades conhecidas", () => {
    expect(
      computeExposureState({
        exposureLastCheckedAt: new Date(),
        exposureRawData: RESULT_WITHOUT_VULNS,
      }),
    ).toBe("no-known-vulnerabilities");
  });
});
