import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateClassificationDto {
  @ApiProperty({ description: 'Ex.: "Homologado", "Aguardando Ajustes", "Rejeitado".' })
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({ description: "Ordem de exibição. Padrão: 0." })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ description: "Cor hex para dashboards/parecer (ex.: #16a34a)." })
  @IsString()
  @MinLength(1)
  color!: string;

  @ApiPropertyOptional({ description: "Texto-base de recomendação para o parecer técnico." })
  @IsOptional()
  @IsString()
  recommendationText?: string;

  @ApiProperty({ description: "Score mínimo do totalScore que resulta nesta classificação." })
  @IsNumber()
  @Min(0)
  minScore!: number;

  @ApiProperty({ description: "Score máximo do totalScore que resulta nesta classificação." })
  @IsNumber()
  @Min(0)
  maxScore!: number;
}
