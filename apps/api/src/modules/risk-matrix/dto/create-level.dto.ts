import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateLevelDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({ description: "Ordem de exibição (ex.: 1=melhor faixa). Padrão: 0." })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ description: "Score mínimo da faixa (mesma escala do motor de risco, 0-5)." })
  @IsNumber()
  @Min(0)
  minScore!: number;

  @ApiProperty({ description: "Score máximo da faixa." })
  @IsNumber()
  @Min(0)
  maxScore!: number;
}
