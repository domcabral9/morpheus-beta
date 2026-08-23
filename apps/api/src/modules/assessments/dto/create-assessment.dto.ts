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

  @ApiPropertyOptional({
    description:
      "Fornecedor cadastrado (Vendor) vinculado a esta avaliação - opcional, o texto livre acima continua sendo a fonte de verdade exibida em toda a aplicação.",
  })
  @IsOptional()
  @IsString()
  vendorId?: string;

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

  @ApiProperty({
    description:
      "Existe Relatório SOC 2? Declaração do solicitante - se true, um anexo na categoria SOC2_REPORT é exigido antes do envio para análise.",
  })
  @IsBoolean()
  hasSoc2Report!: boolean;

  @ApiProperty({
    description: "Mesma regra de `hasSoc2Report`, para o certificado ISO 27001.",
  })
  @IsBoolean()
  hasIso27001Certificate!: boolean;

  @ApiPropertyOptional({
    description:
      "Marca o registro como dado de teste efêmero. Exige platform:cross-tenant - rejeitado (403) para qualquer outro usuário.",
  })
  @IsOptional()
  @IsBoolean()
  isSampleData?: boolean;
}

export { CRITICALITY_VALUES };
