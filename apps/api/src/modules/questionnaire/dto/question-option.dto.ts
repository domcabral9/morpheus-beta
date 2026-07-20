import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class QuestionOptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  value!: string;

  @ApiProperty({ description: "Contribuição de risco desta opção (0 = sem risco)." })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}
