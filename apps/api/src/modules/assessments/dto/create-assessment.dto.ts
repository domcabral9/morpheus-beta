import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MinLength } from "class-validator";

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const SHA256_HEX_PATTERN = /^[a-fA-F0-9]{64}$/;

export class CreateAssessmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  softwareName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  vendor!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: "url deve ser uma URL válida" })
  url?: string;

  @ApiProperty({ description: "userId do responsável indicado pelo solicitante." })
  @IsString()
  responsibleId!: string;

  @ApiProperty()
  @IsString()
  areaId!: string;

  @ApiProperty({ enum: CRITICALITY_VALUES })
  @IsIn(CRITICALITY_VALUES)
  criticality!: (typeof CRITICALITY_VALUES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  justification!: string;

  @ApiPropertyOptional({ description: "Referência a um ticket externo (Jira/ServiceNow/etc.)." })
  @IsOptional()
  @IsString()
  linkedTicket?: string;

  @ApiPropertyOptional({
    description: "SHA-256 do instalador/binário avaliado, em hexadecimal (64 caracteres).",
  })
  @IsOptional()
  @IsString()
  @Matches(SHA256_HEX_PATTERN, {
    message: "installerFileHash deve ser um SHA-256 hexadecimal válido",
  })
  installerFileHash?: string;

  @ApiProperty({
    description:
      "O fornecedor tem ART (Análise de Risco) documentada? Declaração do solicitante - verificada manualmente pelo aprovador.",
  })
  @IsBoolean()
  hasRiskAnalysis!: boolean;

  @ApiProperty({
    description: "O fornecedor tem cláusula de segurança da informação assinada?",
  })
  @IsBoolean()
  hasInfoSecClause!: boolean;
}

export { CRITICALITY_VALUES };
