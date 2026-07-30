import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { VendorQuestionOptionDto } from "./vendor-question-option.dto";

const VENDOR_QUESTION_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "SCALE", "TEXT"] as const;

export class CreateVendorQuestionDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Peso da pergunta no score final (ex.: 1 a 3)." })
  @IsNumber()
  @Min(0)
  weight!: number;

  @ApiProperty({ enum: VENDOR_QUESTION_TYPES })
  @IsIn(VENDOR_QUESTION_TYPES)
  type!: (typeof VENDOR_QUESTION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    type: [VendorQuestionOptionDto],
    description: "Obrigatório para SINGLE_CHOICE/MULTI_CHOICE; ignorado para SCALE/TEXT.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VendorQuestionOptionDto)
  options?: VendorQuestionOptionDto[];
}

export { VENDOR_QUESTION_TYPES };
