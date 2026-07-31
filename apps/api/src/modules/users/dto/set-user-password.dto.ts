import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class SetUserPasswordDto {
  // Força real é validada em runtime via PasswordPolicyService, não aqui -
  // a política é configurável (super-admin), não pode ser um @Matches fixo.
  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}
