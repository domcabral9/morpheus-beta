import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class SwitchTenantDto {
  @ApiProperty({ description: "Id do tenant a visualizar/editar (ou o homeTenantId, para voltar)." })
  @IsString()
  @MinLength(1)
  tenantId!: string;
}
