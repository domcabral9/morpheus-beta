import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  SOFTWARE_TYPES,
  DATA_CLASSIFICATIONS,
  CRITICALITY_VALUES,
  MAX_DOCUMENTATION_LINKS,
  DocumentationLinkDto,
} from "./create-inventory-item.dto";

const INVENTORY_STATUSES = ["ACTIVE", "PENDING_REVIEW", "EXPIRED", "DECOMMISSIONED"] as const;

export class UpdateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @ApiPropertyOptional({ enum: SOFTWARE_TYPES })
  @IsOptional()
  @IsIn(SOFTWARE_TYPES)
  type?: (typeof SOFTWARE_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostingProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicalResponsibleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextReviewDate?: string;

  @ApiPropertyOptional({ enum: INVENTORY_STATUSES })
  @IsOptional()
  @IsIn(INVENTORY_STATUSES)
  status?: (typeof INVENTORY_STATUSES)[number];

  @ApiPropertyOptional({ enum: CRITICALITY_VALUES })
  @IsOptional()
  @IsIn(CRITICALITY_VALUES)
  criticality?: (typeof CRITICALITY_VALUES)[number];

  @ApiPropertyOptional({ enum: DATA_CLASSIFICATIONS })
  @IsOptional()
  @IsIn(DATA_CLASSIFICATIONS)
  dataClassification?: (typeof DATA_CLASSIFICATIONS)[number];

  @ApiPropertyOptional({
    description:
      "Só pode ser alterado em itens de entrada manual - rejeitado com 400 se o item tiver assessmentId (valor herdado da homologação).",
  })
  @IsOptional()
  @IsBoolean()
  hasRiskAnalysis?: boolean;

  @ApiPropertyOptional({
    description: "Mesma regra de `hasRiskAnalysis`.",
  })
  @IsOptional()
  @IsBoolean()
  hasInfoSecClause?: boolean;

  @ApiPropertyOptional({
    type: [DocumentationLinkDto],
    description: "Substitui a lista inteira de links quando enviado (não faz merge parcial).",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DOCUMENTATION_LINKS)
  @ValidateNested({ each: true })
  @Type(() => DocumentationLinkDto)
  documentationLinks?: DocumentationLinkDto[];
}

export { INVENTORY_STATUSES };
