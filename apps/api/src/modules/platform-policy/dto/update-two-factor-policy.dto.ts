import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateTwoFactorPolicyDto {
  @ApiProperty()
  @IsBoolean()
  enforced!: boolean;
}
