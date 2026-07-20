import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { CRITICALITY_VALUES } from "./create-assessment.dto";

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  softwareName?: string;

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
  @IsUrl({}, { message: "url deve ser uma URL válida" })
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({ enum: CRITICALITY_VALUES })
  @IsOptional()
  @IsIn(CRITICALITY_VALUES)
  criticality?: (typeof CRITICALITY_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  justification?: string;
}
