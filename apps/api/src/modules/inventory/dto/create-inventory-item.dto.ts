import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

const SOFTWARE_TYPES = ["SAAS", "ON_PREMISES", "DESKTOP", "MOBILE", "API_INTEGRATION"] as const;
const DATA_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const MAX_DOCUMENTATION_LINKS = 10;

export class DocumentationLinkDto {
  @ApiProperty({ description: 'Ex.: "Jira", "Swagger / OpenAPI", "Postman".' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty()
  @IsUrl({ require_protocol: true })
  url!: string;
}

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

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
  @IsString()
  url?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiProperty({ enum: SOFTWARE_TYPES })
  @IsIn(SOFTWARE_TYPES)
  type!: (typeof SOFTWARE_TYPES)[number];

  @ApiPropertyOptional({ description: 'Ex.: "AWS", "Google Cloud", "Datacenter próprio".' })
  @IsOptional()
  @IsString()
  hostingProvider?: string;

  @ApiProperty()
  @IsString()
  areaId!: string;

  @ApiProperty({ description: "userId do gestor responsável pelo ativo." })
  @IsString()
  managerId!: string;

  @ApiProperty({ description: "userId do responsável técnico pelo ativo." })
  @IsString()
  technicalResponsibleId!: string;

  @ApiProperty()
  @IsDateString()
  homologationDate!: string;

  @ApiProperty()
  @IsDateString()
  nextReviewDate!: string;

  @ApiProperty({ enum: CRITICALITY_VALUES })
  @IsIn(CRITICALITY_VALUES)
  criticality!: (typeof CRITICALITY_VALUES)[number];

  @ApiProperty({ enum: DATA_CLASSIFICATIONS })
  @IsIn(DATA_CLASSIFICATIONS)
  dataClassification!: (typeof DATA_CLASSIFICATIONS)[number];

  @ApiPropertyOptional({
    type: [DocumentationLinkDto],
    description:
      "Links externos de documentação (Jira, Swagger/OpenAPI, etc.) - sobretudo útil para itens do tipo API_INTEGRATION.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DOCUMENTATION_LINKS)
  @ValidateNested({ each: true })
  @Type(() => DocumentationLinkDto)
  documentationLinks?: DocumentationLinkDto[];
}

export { SOFTWARE_TYPES, DATA_CLASSIFICATIONS, CRITICALITY_VALUES, MAX_DOCUMENTATION_LINKS };
