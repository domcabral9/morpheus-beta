import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

/** Reusado por PATCH /auth/2fa/disable e POST /auth/2fa/backup-codes/regenerate
 * - as duas mutações sensíveis de 2FA exigem "prove que ainda é você". */
export class TwoFactorReauthDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
