import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength } from "class-validator";

/** Aceita tanto um código TOTP de 6 dígitos quanto um backup code
 * `XXXX-XXXX` - TwoFactorService.verifyLoginCode distingue por padrão. */
export class VerifyTwoFactorLoginDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}
