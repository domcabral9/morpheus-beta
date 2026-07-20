import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

export class AnswerInputDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiPropertyOptional({ description: "Para perguntas do tipo TEXT." })
  @IsOptional()
  @IsString()
  textValue?: string;

  @ApiPropertyOptional({ description: "Para perguntas do tipo SCALE." })
  @IsOptional()
  @IsInt()
  scaleValue?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      "IDs de QuestionOption selecionadas (SINGLE_CHOICE tem 1, MULTI_CHOICE pode ter várias).",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  selectedOptionIds?: string[];
}

export class SubmitAnswersDto {
  @ApiProperty({ type: [AnswerInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers!: AnswerInputDto[];
}
