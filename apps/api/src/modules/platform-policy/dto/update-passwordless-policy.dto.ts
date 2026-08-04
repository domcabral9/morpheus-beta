import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdatePasswordlessPolicyDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
