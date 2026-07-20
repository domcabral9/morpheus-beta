import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { QUESTION_TYPES, RISK_DIMENSIONS } from "./create-question.dto";

export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ enum: QUESTION_TYPES })
  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: (typeof QUESTION_TYPES)[number];

  @ApiPropertyOptional({ enum: RISK_DIMENSIONS })
  @IsOptional()
  @IsIn(RISK_DIMENSIONS)
  riskDimension?: (typeof RISK_DIMENSIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
