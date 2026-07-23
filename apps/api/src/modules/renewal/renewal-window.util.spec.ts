import { computeRenewalTrigger } from "./renewal-window.util";

// Janela de referência usada em todos os 5 exemplos numéricos confirmados
// com o usuário (ver plano de renovação anual, Fase 3), exceto o exemplo 5
// que usa uma janela mais curta especificamente pra provar que a regra nunca
// reduz o prazo padrão de 30 dias.
const WINDOW_NOV_DEC = { enabled: true, start: "11-01", end: "12-14" };

function d(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

describe("computeRenewalTrigger", () => {
  it("janela desabilitada: gatilho e vencimento naturais, sem ajuste", () => {
    const result = computeRenewalTrigger(d("2026-11-01"), { enabled: false, start: "11-01", end: "12-14" });
    expect(result.gatilhoEfetivo).toEqual(d("2026-11-01"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-12-01"));
  });

  it("exemplo 1: gatilho 01/nov (dentro da janela) -> vencimento estendido pro fim da janela (14/dez)", () => {
    const result = computeRenewalTrigger(d("2026-11-01"), WINDOW_NOV_DEC);
    expect(result.gatilhoEfetivo).toEqual(d("2026-11-01"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-12-14"));
  });

  it("exemplo 2: vencimento 30/out (fora dos dois lados) -> nada muda", () => {
    const result = computeRenewalTrigger(d("2026-09-30"), WINDOW_NOV_DEC);
    expect(result.gatilhoEfetivo).toEqual(d("2026-09-30"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-10-30"));
  });

  it("exemplo 3: gatilho 15/dez (um dia depois do fim da janela) -> nada muda", () => {
    const result = computeRenewalTrigger(d("2026-12-15"), WINDOW_NOV_DEC);
    expect(result.gatilhoEfetivo).toEqual(d("2026-12-15"));
    expect(result.vencimentoEfetivo).toEqual(d("2027-01-14"));
  });

  it("exemplo 4: vencimento 14/dez (dentro, é o próprio fim) -> gatilho antecipado pro início da janela", () => {
    const result = computeRenewalTrigger(d("2026-11-14"), WINDOW_NOV_DEC);
    expect(result.gatilhoEfetivo).toEqual(d("2026-11-01"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-12-14"));
  });

  it("exemplo 5a: janela curta 01-15/nov, gatilho 02/nov (dentro) -> vencimento SEM redução (02/dez)", () => {
    const shortWindow = { enabled: true, start: "11-01", end: "11-15" };
    const result = computeRenewalTrigger(d("2026-11-02"), shortWindow);
    expect(result.gatilhoEfetivo).toEqual(d("2026-11-01"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-12-02"));
  });

  it("exemplo 5b: janela curta 01-15/nov, vencimento 01/nov (dentro) -> vencimento estendido pro fim (15/nov)", () => {
    const shortWindow = { enabled: true, start: "11-01", end: "11-15" };
    const result = computeRenewalTrigger(d("2026-10-02"), shortWindow);
    expect(result.gatilhoEfetivo).toEqual(d("2026-10-02"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-11-15"));
  });

  it("vencimento dentro da janela mas gatilho bem antes dela: só o vencimento estende, gatilho fica intocado", () => {
    const shortWindow = { enabled: true, start: "12-01", end: "12-14" };
    const result = computeRenewalTrigger(d("2026-11-10"), shortWindow);
    expect(result.gatilhoEfetivo).toEqual(d("2026-11-10"));
    expect(result.vencimentoEfetivo).toEqual(d("2026-12-14"));
  });

  it("janela cruzando a virada do ano (ex.: 20/dez a 10/jan) é reconhecida corretamente", () => {
    const wrapWindow = { enabled: true, start: "12-20", end: "01-10" };
    const result = computeRenewalTrigger(d("2026-12-25"), wrapWindow);
    expect(result.gatilhoEfetivo).toEqual(d("2026-12-20"));
    expect(result.vencimentoEfetivo).toEqual(d("2027-01-24"));
  });
});
