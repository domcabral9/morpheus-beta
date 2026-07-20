import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import {
  SOFTWARE_TYPES,
  DATA_CLASSIFICATIONS,
  CRITICALITY_VALUES,
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
}

export { INVENTORY_STATUSES };
