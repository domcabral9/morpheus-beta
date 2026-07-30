import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString } from "class-validator";

export class VendorAnswerInputDto {
  @ApiProperty()
  @IsString()
  vendorQuestionId!: string;

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
    description: "IDs de VendorQuestionOption selecionadas - SINGLE_CHOICE/MULTI_CHOICE.",
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedOptionIds?: string[];
}
