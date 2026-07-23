import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { INVENTORY_STATUSES } from "./update-inventory-item.dto";

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

  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: "csv" })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: (typeof EXPORT_FORMATS)[number] = "csv";
}

export { EXPORT_FORMATS };
