import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsString, Min, MinLength } from "class-validator";

/**
 * Um threshold é sempre identificado por `tier` (1 a N) dentro do
 * VendorTierConfig - criar/atualizar é a mesma operação (upsert por
 * `[vendorTierConfigId, tier]`), então um DTO único cobre os dois casos.
 */
export class UpsertVendorTierThresholdDto {
  @ApiProperty({ description: "1 = melhor cenário/menos acompanhamento, maior = pior." })
  @IsInt()
  @Min(1)
  tier!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  color!: string;

  @ApiProperty({ description: "Faixa do score final (0 a 5, quanto maior mais favorável)." })
  @IsNumber()
  @Min(0)
  minScore!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  maxScore!: number;

  @ApiProperty({ description: "Cadência base de reavaliação, em meses, antes do ajuste por criticidade." })
  @IsInt()
  @Min(1)
  baseReassessmentMonths!: number;
}
