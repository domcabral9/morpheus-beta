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
import { QuestionOptionDto } from "./question-option.dto";

const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "SCALE", "TEXT"] as const;
const RISK_DIMENSIONS = ["PROBABILITY", "IMPACT", "BOTH"] as const;

export class CreateQuestionDto {
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

  @ApiProperty({ description: "Peso da pergunta no score final (ex.: 1 a 10)." })
  @IsNumber()
  @Min(0)
  weight!: number;

  @ApiProperty({ enum: QUESTION_TYPES })
  @IsIn(QUESTION_TYPES)
  type!: (typeof QUESTION_TYPES)[number];

  @ApiProperty({ enum: RISK_DIMENSIONS })
  @IsIn(RISK_DIMENSIONS)
  riskDimension!: (typeof RISK_DIMENSIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({
    default: true,
    description: "false para perguntas condicionais (ex.: detalhe de MFA só se MFA = Sim).",
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    type: [QuestionOptionDto],
    description: "Obrigatório para SINGLE_CHOICE/MULTI_CHOICE; ignorado para SCALE/TEXT.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];
}

// Reexport para uso em outros arquivos do módulo sem duplicar a lista.
export { QUESTION_TYPES, RISK_DIMENSIONS };
