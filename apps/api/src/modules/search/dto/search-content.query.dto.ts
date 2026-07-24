import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class SearchContentQueryDto {
  @ApiPropertyOptional({ minLength: 2 })
  @IsString()
  @MinLength(2)
  q!: string;
}
