import { Test } from "@nestjs/testing";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./prisma.health";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        PrismaHealthIndicator,
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) },
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it("responde liveness com status ok sem checar dependências", async () => {
    const result = await controller.live();
    expect(result.status).toBe("ok");
  });

  it("responde readiness validando a conexão com o banco", async () => {
    const result = await controller.ready();
    expect(result.status).toBe("ok");
    expect(result.details.database?.status).toBe("up");
  });
});
