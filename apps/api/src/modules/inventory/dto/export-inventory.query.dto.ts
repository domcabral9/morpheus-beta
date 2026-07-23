import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsIn, IsOptional, IsString } from "class-validator";
import { INVENTORY_STATUSES } from "./update-inventory-item.dto";
import { SOFTWARE_TYPES, CRITICALITY_VALUES } from "./create-inventory-item.dto";
import { ORIGIN_VALUES } from "./list-inventory.query.dto";

const EXPORT_FORMATS = ["csv", "json"] as const;

export class ExportInventoryQueryDto {
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

  @ApiPropertyOptional({ enum: ORIGIN_VALUES })
  @IsOptional()
  @IsIn(ORIGIN_VALUES)
  origin?: (typeof ORIGIN_VALUES)[number];

  @ApiPropertyOptional({ description: '"true" ou "false" - filtra por declaração de ART.' })
  @IsOptional()
  @IsBooleanString()
  hasRiskAnalysis?: string;

  @ApiPropertyOptional({ description: '"true" ou "false" - filtra por declaração de cláusula InfoSec.' })
  @IsOptional()
  @IsBooleanString()
  hasInfoSecClause?: string;

  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: "csv" })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: (typeof EXPORT_FORMATS)[number] = "csv";
}

export { EXPORT_FORMATS };
