import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ListControlsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frameworkId?: string;
}
