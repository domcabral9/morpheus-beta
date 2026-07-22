import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListTechnicalOpinionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuedById?: string;

  @ApiPropertyOptional({ description: 'Ex.: "Homologado", "Rejeitado", "Aguardando Ajustes".' })
  @IsOptional()
  @IsString()
  classificationLabel?: string;

  @ApiPropertyOptional({ description: "Busca por prefixo do número do parecer." })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — início do intervalo (inclusive), sobre issuedAt." })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO 8601 — fim do intervalo (inclusive), sobre issuedAt." })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
