import { ReputationBudgetRepository } from "./reputation-budget.repository";
import { PrismaService } from "../../../prisma/prisma.service";

// $executeRaw é atômico por natureza no Postgres (UPDATE bloqueia a linha) -
// isso não é testável com mock (não simula lock real), só contra o banco de
// verdade (validado manualmente disparando chamadas concorrentes reais
// contra o dev, ver CHANGELOG). Aqui testamos só a lógica de wiring: o
// método interpreta corretamente o resultado de `$executeRaw`.
describe("ReputationBudgetRepository", () => {
  let repo: ReputationBudgetRepository;
  let prisma: {
    enrichmentDailyBudget: { upsert: jest.Mock };
    $executeRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      enrichmentDailyBudget: { upsert: jest.fn().mockResolvedValue(undefined) },
      $executeRaw: jest.fn(),
    };
    repo = new ReputationBudgetRepository(prisma as unknown as PrismaService);
  });

  it("devolve true quando o UPDATE afeta 1 linha (orçamento disponível)", async () => {
    prisma.$executeRaw.mockResolvedValue(1);
    expect(await repo.tryConsume(450)).toBe(true);
  });

  it("devolve false quando o UPDATE não afeta nenhuma linha (orçamento esgotado)", async () => {
    prisma.$executeRaw.mockResolvedValue(0);
    expect(await repo.tryConsume(450)).toBe(false);
  });

  it("garante a linha do dia (upsert autocurativo) antes do UPDATE condicional", async () => {
    prisma.$executeRaw.mockResolvedValue(1);
    await repo.tryConsume(450);
    expect(prisma.enrichmentDailyBudget.upsert).toHaveBeenCalled();
  });
});
