import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class ReputationBudgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consome atomicamente 1 unidade do orçamento diário de chamadas ao
   * VirusTotal - devolve `true` se havia orçamento disponível, `false` se já
   * esgotado. É o ponto real de enforcement (ver plano/CHANGELOG do arco):
   * compartilhado entre o botão manual e a varredura noturna, então cliques
   * concorrentes de vários usuários somados ao job automático nunca
   * ultrapassam o teto do tier gratuito.
   *
   * `UPDATE ... WHERE calls_used < budget` é atômico por natureza no
   * Postgres (a linha é bloqueada durante o UPDATE) - duas chamadas
   * concorrentes perto do limite nunca conseguem as duas passar.
   */
  async tryConsume(dailyBudget: number): Promise<boolean> {
    const date = todayDateOnly();
    await this.prisma.enrichmentDailyBudget.upsert({
      where: { date },
      update: {},
      create: { date, virusTotalCallsUsed: 0 },
    });

    const updatedRows = await this.prisma.$executeRaw`
      UPDATE enrichment_daily_budgets
      SET "virusTotalCallsUsed" = "virusTotalCallsUsed" + 1, "updatedAt" = now()
      WHERE date = ${date} AND "virusTotalCallsUsed" < ${dailyBudget}
    `;
    return updatedRows > 0;
  }
}
