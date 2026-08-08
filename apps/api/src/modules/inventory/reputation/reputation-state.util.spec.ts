import { computeReputationState } from "./reputation-state.util";

describe("computeReputationState", () => {
  it("verified-clean quando há checagem recente com veredito CLEAN", () => {
    expect(
      computeReputationState({
        reputationLastCheckedAt: new Date(),
        reputationVerdict: "CLEAN",
        reputationDeclaredKnown: false,
      }),
    ).toBe("verified-clean");
  });

  it("verified-suspicious quando há checagem recente com veredito SUSPICIOUS", () => {
    expect(
      computeReputationState({
        reputationLastCheckedAt: new Date(),
        reputationVerdict: "SUSPICIOUS",
        reputationDeclaredKnown: false,
      }),
    ).toBe("verified-suspicious");
  });

  it("checagem automática fala mais alto que a flag declarada", () => {
    expect(
      computeReputationState({
        reputationLastCheckedAt: new Date(),
        reputationVerdict: "CLEAN",
        reputationDeclaredKnown: true,
      }),
    ).toBe("verified-clean");
  });

  it("declared-known quando não há checagem mas a flag manual está marcada", () => {
    expect(
      computeReputationState({
        reputationLastCheckedAt: null,
        reputationVerdict: null,
        reputationDeclaredKnown: true,
      }),
    ).toBe("declared-known");
  });

  it("unverified sem checagem e sem flag declarada", () => {
    expect(
      computeReputationState({
        reputationLastCheckedAt: null,
        reputationVerdict: null,
        reputationDeclaredKnown: false,
      }),
    ).toBe("unverified");
  });

  it("unverified se houver data de checagem mas veredito null (estado inconsistente defensivo)", () => {
    expect(
      computeReputationState({
        reputationLastCheckedAt: new Date(),
        reputationVerdict: null,
        reputationDeclaredKnown: false,
      }),
    ).toBe("unverified");
  });
});
