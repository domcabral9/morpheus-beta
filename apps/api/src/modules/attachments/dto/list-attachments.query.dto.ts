import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ListAttachmentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventoryItemId?: string;
}
