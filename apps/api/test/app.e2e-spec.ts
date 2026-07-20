import type { Server } from "node:http";
import cookieParser from "cookie-parser";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SanitizationPipe } from "../src/common/pipes/sanitization.pipe";

/**
 * Teste e2e do caminho crítico completo, contra um Postgres real (não
 * mockado) — diferente dos *.spec.ts (unitários, repositórios sempre
 * mockados). Replica o bootstrap essencial de main.ts (cookie-parser,
 * SanitizationPipe + ValidationPipe) porque o app aqui é criado via
 * Test.createTestingModule, não pela função bootstrap() real.
 *
 * Requer DATABASE_URL apontando para um Postgres com o seed já aplicado
 * (usuários "admin@morpheus.demo"/"usuario@morpheus.demo", tenant "demo").
 */
describe("Fluxo crítico (e2e)", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let createdAssessmentId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new SanitizationPipe(),
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    // Best-effort: a limpeza não pode derrubar o resultado dos testes que já
    // rodaram — se falhar, só avisa. Cascade cuida de answers/versions/
    // workflow instance/step executions/risk results/technical opinion.
    if (createdAssessmentId) {
      try {
        await prisma.assessment.delete({ where: { id: createdAssessmentId } });
      } catch (error) {
        console.warn("Falha ao limpar a avaliação criada pelo e2e:", error);
      }
    }
    await app.close();
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(server)
      .post("/auth/login")
      .send({ tenantSlug: "demo", email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  it("GET /health/ready responde 200 com o banco operacional", async () => {
    const response = await request(server).get("/health/ready").expect(200);
    expect(response.body.status).toBe("ok");
  });

  it(
    "percorre o caminho crítico: login -> criar avaliação -> responder questionário -> " +
      "enviar -> aprovar em todas as etapas -> avaliação homologada com parecer técnico",
    async () => {
      const requesterToken = await login("usuario@morpheus.demo", "Demo@12345");
      const approverToken = await login("admin@morpheus.demo", "Demo@12345");

      const requester = await request(server)
        .get("/auth/me")
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);

      const areas = await request(server)
        .get("/areas")
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);
      expect(areas.body.length).toBeGreaterThan(0);
      const areaId = areas.body[0].id as string;

      const created = await request(server)
        .post("/assessments")
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({
          softwareName: `E2E Test Software ${Date.now()}`,
          vendor: "Fornecedor E2E",
          areaId,
          responsibleId: requester.body.id,
          criticality: "MEDIUM",
          justification: "Criada pelo teste e2e do caminho crítico.",
        })
        .expect(201);
      createdAssessmentId = created.body.id as string;

      const categories = await request(server)
        .get("/questionnaire/categories")
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);

      const answers = buildAnswersForAllQuestions(
        categories.body as Array<{ questions: QuestionForAnswer[] }>,
      );

      await request(server)
        .put(`/assessments/${createdAssessmentId}/answers`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({ answers })
        .expect(200);

      await request(server)
        .post(`/assessments/${createdAssessmentId}/submit`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(201);

      // Admin acumula todos os papéis aprovadores do fluxo padrão no tenant
      // demo (ver comentário no seed) — decide cada etapa até o fluxo fechar.
      await decideEveryStepUntilClosed(server, approverToken, createdAssessmentId);

      const finalAssessment = await request(server)
        .get(`/assessments/${createdAssessmentId}`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);
      expect(finalAssessment.body.status).toBe("APPROVED");

      const opinion = await request(server)
        .get(`/technical-opinions/assessments/${createdAssessmentId}`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);
      expect(opinion.body.hash).toEqual(expect.any(String));
      expect(opinion.body.number).toEqual(expect.any(String));
    },
    30_000,
  );

  it("bloqueia acesso sem token de autenticação", async () => {
    await request(server).get("/assessments").expect(401);
  });
});

interface QuestionForAnswer {
  id: string;
  type: "TEXT" | "SCALE" | "SINGLE_CHOICE" | "MULTI_CHOICE";
  isRequired: boolean;
  options: Array<{ id: string }>;
}

function buildAnswersForAllQuestions(
  categories: Array<{ questions: QuestionForAnswer[] }>,
): Array<Record<string, unknown>> {
  const answers: Array<Record<string, unknown>> = [];
  for (const category of categories) {
    for (const question of category.questions) {
      if (question.type === "TEXT") {
        answers.push({ questionId: question.id, textValue: "Resposta de teste e2e." });
      } else if (question.type === "SCALE") {
        answers.push({ questionId: question.id, scaleValue: 1 });
      } else if (question.options.length > 0) {
        answers.push({ questionId: question.id, selectedOptionIds: [question.options[0]!.id] });
      }
    }
  }
  return answers;
}

async function decideEveryStepUntilClosed(
  server: Server,
  approverToken: string,
  assessmentId: string,
): Promise<void> {
  const MAX_STEPS = 10;
  for (let i = 0; i < MAX_STEPS; i++) {
    const instance = await request(server)
      .get(`/workflow/assessments/${assessmentId}`)
      .set("Authorization", `Bearer ${approverToken}`)
      .expect(200);

    if (instance.body.status !== "IN_PROGRESS") return;

    const pending = (instance.body.stepExecutions as Array<{ id: string; status: string }>).find(
      (execution) => execution.status === "IN_PROGRESS",
    );
    if (!pending) return;

    await request(server)
      .post(`/workflow/steps/${pending.id}/decide`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({ decision: "APPROVE" })
      .expect(201);
  }
  throw new Error(`Fluxo não fechou após ${MAX_STEPS} decisões — possível loop.`);
}
