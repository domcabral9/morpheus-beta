import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateTenantDto } from "./update-tenant.dto";

async function validateDto(payload: Partial<UpdateTenantDto>) {
  const dto = plainToInstance(UpdateTenantDto, payload);
  return validate(dto);
}

describe("UpdateTenantDto (janela de fechamento anual)", () => {
  it("aceita annualClosingWindowStart/End em formato MM-DD válido", async () => {
    const errors = await validateDto({
      annualClosingWindowStart: "11-01",
      annualClosingWindowEnd: "12-14",
      annualClosingWindowEnabled: true,
    });
    expect(errors).toHaveLength(0);
  });

  it("rejeita annualClosingWindowStart fora do formato MM-DD", async () => {
    const errors = await validateDto({ annualClosingWindowStart: "2026-11-01" });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.property).toBe("annualClosingWindowStart");
  });

  it("rejeita mês/dia fora do intervalo válido (13-40)", async () => {
    const errors = await validateDto({ annualClosingWindowEnd: "13-40" });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.property).toBe("annualClosingWindowEnd");
  });

  it("aceita annualClosingWindowEnabled ausente/omitido (todos os campos opcionais)", async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it("rejeita annualClosingWindowEnabled com tipo diferente de boolean", async () => {
    const errors = await validateDto({ annualClosingWindowEnabled: "yes" as never });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.property).toBe("annualClosingWindowEnabled");
  });
});
