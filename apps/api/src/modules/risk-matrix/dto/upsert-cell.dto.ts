import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class UpsertCellDto {
  @ApiProperty()
  @IsString()
  probabilityLevelId!: string;

  @ApiProperty()
  @IsString()
  impactLevelId!: string;

  @ApiProperty()
  @IsString()
  riskClassificationId!: string;
}
