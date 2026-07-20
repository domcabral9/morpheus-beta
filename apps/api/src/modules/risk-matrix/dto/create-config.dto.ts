import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateRiskMatrixConfigDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    description: "Score mínimo (0-5) para aprovação automática/recomendada.",
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  minApprovalScore!: number;

  @ApiPropertyOptional({
    default: false,
    description:
      "Se true, ativa esta matriz e desativa qualquer outra do tenant. Uma matriz precisa estar ativa para o motor de risco calcular resultados.",
  })
  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
