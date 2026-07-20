import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

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
}

export { CRITICALITY_VALUES };
