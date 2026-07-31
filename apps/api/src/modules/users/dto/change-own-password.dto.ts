import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangeOwnPasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  // Força real é validada em runtime via PasswordPolicyService, não aqui.
  @ApiProperty()
  @IsString()
  @MinLength(1)
  newPassword!: string;
}
