import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { INVENTORY_STATUSES } from "./update-inventory-item.dto";
import { SOFTWARE_TYPES, CRITICALITY_VALUES } from "./create-inventory-item.dto";

const ORIGIN_VALUES = ["HOMOLOGATED", "MANUAL"] as const;

export class ListInventoryQueryDto {
  @ApiPropertyOptional({ enum: INVENTORY_STATUSES })
  @IsOptional()
  @IsIn(INVENTORY_STATUSES)
  status?: (typeof INVENTORY_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({ enum: SOFTWARE_TYPES })
  @IsOptional()
  @IsIn(SOFTWARE_TYPES)
  type?: (typeof SOFTWARE_TYPES)[number];

  @ApiPropertyOptional({ enum: CRITICALITY_VALUES })
  @IsOptional()
  @IsIn(CRITICALITY_VALUES)
  criticality?: (typeof CRITICALITY_VALUES)[number];

  @ApiPropertyOptional({
    enum: ORIGIN_VALUES,
    description: "HOMOLOGATED = tem assessmentId (veio de homologação). MANUAL = entrada direta.",
  })
  @IsOptional()
  @IsIn(ORIGIN_VALUES)
  origin?: (typeof ORIGIN_VALUES)[number];

  @ApiPropertyOptional({ description: '"true" ou "false" - filtra por declaração de ART.' })
  @IsOptional()
  @IsBooleanString()
  hasRiskAnalysis?: string;

  @ApiPropertyOptional({
    description: '"true" ou "false" - filtra por declaração de cláusula de segurança da informação.',
  })
  @IsOptional()
  @IsBooleanString()
  hasInfoSecClause?: string;

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

export { ORIGIN_VALUES };
