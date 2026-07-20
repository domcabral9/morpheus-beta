import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { INVENTORY_STATUSES } from "./update-inventory-item.dto";

export class ListInventoryQueryDto {
  @ApiPropertyOptional({ enum: INVENTORY_STATUSES })
  @IsOptional()
  @IsIn(INVENTORY_STATUSES)
  status?: (typeof INVENTORY_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

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
