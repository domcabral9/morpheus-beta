import { Test } from "@nestjs/testing";
import { ControlsService } from "./controls.service";
import { ControlsRepository } from "./controls.repository";

describe("ControlsService", () => {
  let service: ControlsService;
  let repo: { findFrameworks: jest.Mock; findControls: jest.Mock; findControlById: jest.Mock };

  beforeEach(async () => {
    repo = {
      findFrameworks: jest.fn(),
      findControls: jest.fn(),
      findControlById: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ControlsService, { provide: ControlsRepository, useValue: repo }],
    }).compile();

    service = moduleRef.get(ControlsService);
  });

  it("lista frameworks delegando ao repositório", async () => {
    repo.findFrameworks.mockResolvedValue([{ id: "fw-1", code: "ISO_27001" }]);
    const result = await service.listFrameworks();
    expect(result).toEqual([{ id: "fw-1", code: "ISO_27001" }]);
  });

  it("lista controles filtrando por framework quando informado", async () => {
    repo.findControls.mockResolvedValue([{ id: "control-1" }]);
    const result = await service.listControls("fw-1");
    expect(repo.findControls).toHaveBeenCalledWith("fw-1");
    expect(result).toEqual([{ id: "control-1" }]);
  });

  it("lista todos os controles quando nenhum framework é informado", async () => {
    repo.findControls.mockResolvedValue([]);
    await service.listControls();
    expect(repo.findControls).toHaveBeenCalledWith(undefined);
  });

  it("busca controle por id", async () => {
    repo.findControlById.mockResolvedValue({ id: "control-1" });
    const result = await service.findById("control-1");
    expect(repo.findControlById).toHaveBeenCalledWith("control-1");
    expect(result).toEqual({ id: "control-1" });
  });
});
