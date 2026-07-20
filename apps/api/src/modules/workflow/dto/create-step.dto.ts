import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateStepDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: "Posição no fluxo. Se omitido, entra no final." })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiProperty({ description: "Role responsável por decidir esta etapa." })
  @IsString()
  responsibleRoleId!: string;

  @ApiProperty({ description: "Prazo (SLA) em horas para decidir esta etapa." })
  @IsInt()
  @Min(1)
  slaHours!: number;

  @ApiPropertyOptional({
    default: false,
    description: "Se true, o aprovador responsável pode pular esta etapa (decisão SKIP).",
  })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: "Se true, esta etapa só entra no fluxo quando a avaliação envolve LGPD.",
  })
  @IsOptional()
  @IsBoolean()
  requiresLgpd?: boolean;
}
