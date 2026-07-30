import { computeNextReviewDate } from "./vendor-reassessment.util";

function d(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

describe("computeNextReviewDate", () => {
  it("criticidade MEDIUM: multiplicador neutro (1.0), meses = base", () => {
    const result = computeNextReviewDate(6, "MEDIUM", d("2026-07-30"));
    expect(result).toEqual(d("2027-01-30"));
  });

  it("criticidade LOW: estende o intervalo (multiplicador 1.5)", () => {
    const result = computeNextReviewDate(6, "LOW", d("2026-01-01"));
    // 6 * 1.5 = 9 meses
    expect(result).toEqual(d("2026-10-01"));
  });

  it("criticidade HIGH: reduz o intervalo (multiplicador 0.75)", () => {
    const result = computeNextReviewDate(12, "HIGH", d("2026-01-01"));
    // 12 * 0.75 = 9 meses
    expect(result).toEqual(d("2026-10-01"));
  });

  it("criticidade CRITICAL: reduz mais (multiplicador 0.5)", () => {
    const result = computeNextReviewDate(12, "CRITICAL", d("2026-01-01"));
    // 12 * 0.5 = 6 meses
    expect(result).toEqual(d("2026-07-01"));
  });

  it("criticidade ausente (null/undefined): trata como MEDIUM", () => {
    const withNull = computeNextReviewDate(6, null, d("2026-01-01"));
    const withUndefined = computeNextReviewDate(6, undefined, d("2026-01-01"));
    expect(withNull).toEqual(d("2026-07-01"));
    expect(withUndefined).toEqual(d("2026-07-01"));
  });

  it("clampa no mínimo de 3 meses mesmo com base baixa + criticidade CRITICAL", () => {
    // 3 * 0.5 = 1.5 -> arredonda 2 -> clampa pra 3 (mínimo)
    const result = computeNextReviewDate(3, "CRITICAL", d("2026-01-01"));
    expect(result).toEqual(d("2026-04-01"));
  });

  it("clampa no máximo de 12 meses mesmo com base alta + criticidade LOW", () => {
    // 12 * 1.5 = 18 -> clampa pra 12 (máximo)
    const result = computeNextReviewDate(12, "LOW", d("2026-01-01"));
    expect(result).toEqual(d("2027-01-01"));
  });
});
