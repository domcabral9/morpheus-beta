const RENEWAL_PERIOD_DAYS = 30;

export interface RenewalWindowConfig {
  enabled: boolean;
  start: string | null;
  end: string | null;
}

export interface RenewalTrigger {
  gatilhoEfetivo: Date;
  vencimentoEfetivo: Date;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseMonthDay(value: string): { month: number; day: number } {
  const [month, day] = value.split("-");
  return { month: Number(month), day: Number(day) };
}

function resolveWindowForYear(year: number, start: string, end: string): { start: Date; end: Date } {
  const startParts = parseMonthDay(start);
  const endParts = parseMonthDay(end);
  const windowStart = new Date(year, startParts.month - 1, startParts.day);
  let windowEnd = new Date(year, endParts.month - 1, endParts.day);
  if (windowEnd < windowStart) {
    // Janela cruza a virada do ano (ex.: 12-20 até 01-10).
    windowEnd = new Date(year + 1, endParts.month - 1, endParts.day);
  }
  return { start: windowStart, end: windowEnd };
}

/**
 * A janela do tenant não tem ano fixo (só "MM-DD") - pra saber se `date` cai
 * dentro dela, testa a instância da janela no ano de `date` e no ano
 * anterior (cobre também janelas que cruzam a virada do ano).
 */
function findContainingWindow(date: Date, start: string, end: string): { start: Date; end: Date } | null {
  for (const year of [date.getFullYear() - 1, date.getFullYear()]) {
    const window = resolveWindowForYear(year, start, end);
    if (date >= window.start && date <= window.end) return window;
  }
  return null;
}

/**
 * Algoritmo da janela de fechamento anual (derivado com o usuário via 5
 * exemplos numéricos concretos - ver plano de renovação anual, Fase 3).
 * Nunca reduz o prazo padrão de 30 dias corridos, só estende, a favor de
 * quem está sendo avaliado:
 * - se o gatilho natural cai dentro da janela, o gatilho é antecipado pro
 *   início da janela (mais tempo de reação) e o vencimento nunca fica antes
 *   do fim da janela.
 * - senão, se só o vencimento natural cai dentro da janela, o vencimento é
 *   estendido até o fim da janela (evita expirar durante a janela).
 * - senão, nada muda.
 */
export function computeRenewalTrigger(nextReviewDate: Date, window: RenewalWindowConfig): RenewalTrigger {
  const gatilhoNatural = startOfDay(nextReviewDate);
  const vencimentoNatural = addDays(gatilhoNatural, RENEWAL_PERIOD_DAYS);

  if (!window.enabled || !window.start || !window.end) {
    return { gatilhoEfetivo: gatilhoNatural, vencimentoEfetivo: vencimentoNatural };
  }

  const gatilhoWindow = findContainingWindow(gatilhoNatural, window.start, window.end);
  if (gatilhoWindow) {
    return {
      gatilhoEfetivo: gatilhoWindow.start,
      vencimentoEfetivo: vencimentoNatural > gatilhoWindow.end ? vencimentoNatural : gatilhoWindow.end,
    };
  }

  const vencimentoWindow = findContainingWindow(vencimentoNatural, window.start, window.end);
  if (vencimentoWindow) {
    return {
      gatilhoEfetivo: gatilhoNatural < vencimentoWindow.start ? gatilhoNatural : vencimentoWindow.start,
      vencimentoEfetivo: vencimentoWindow.end,
    };
  }

  return { gatilhoEfetivo: gatilhoNatural, vencimentoEfetivo: vencimentoNatural };
}
