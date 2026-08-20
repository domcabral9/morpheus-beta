import { isVendorComplete } from "./vendor-completeness.util";

const COMPLETE = {
  name: "Fornecedor X",
  legalName: "Fornecedor X Ltda",
  taxId: "12.345.678/0001-90",
  businessCriticality: "MEDIUM",
};

describe("isVendorComplete", () => {
  it("retorna true quando os 4 campos estão preenchidos", () => {
    expect(isVendorComplete(COMPLETE)).toBe(true);
  });

  it("retorna false quando legalName está ausente", () => {
    expect(isVendorComplete({ ...COMPLETE, legalName: null })).toBe(false);
  });

  it("retorna false quando taxId está ausente", () => {
    expect(isVendorComplete({ ...COMPLETE, taxId: undefined })).toBe(false);
  });

  it("retorna false quando businessCriticality está ausente", () => {
    expect(isVendorComplete({ ...COMPLETE, businessCriticality: null })).toBe(false);
  });

  it("retorna false quando name está vazio (só espaços)", () => {
    expect(isVendorComplete({ ...COMPLETE, name: "   " })).toBe(false);
  });

  it("retorna false quando legalName é string vazia", () => {
    expect(isVendorComplete({ ...COMPLETE, legalName: "" })).toBe(false);
  });
});
