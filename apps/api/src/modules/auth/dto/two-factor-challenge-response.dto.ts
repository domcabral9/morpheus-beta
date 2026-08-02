import { ApiProperty } from "@nestjs/swagger";

/**
 * Resposta de POST /auth/login quando o usuário tem 2FA habilitado - nenhum
 * cookie de sessão é setado ainda (ver AuthController.login). O frontend usa
 * `preAuthToken` como Bearer em POST /auth/2fa/verify-login.
 */
export class TwoFactorChallengeResponseDto {
  @ApiProperty({ enum: [true] })
  twoFactorRequired!: true;

  @ApiProperty()
  preAuthToken!: string;

  @ApiProperty({ example: "5m" })
  expiresIn!: string;
}
