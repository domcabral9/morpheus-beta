import { ForbiddenException } from "@nestjs/common";
import { SeparationOfDutiesService } from "./separation-of-duties.service";

describe("SeparationOfDutiesService", () => {
  const service = new SeparationOfDutiesService();

  it("permite quando o aprovador é diferente do solicitante", () => {
    expect(() => service.assertNotSelfApproval("user-1", "user-2")).not.toThrow();
  });

  it("bloqueia quando o aprovador é o próprio solicitante", () => {
    expect(() => service.assertNotSelfApproval("user-1", "user-1")).toThrow(ForbiddenException);
  });
});
