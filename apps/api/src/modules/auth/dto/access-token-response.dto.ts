import { ApiProperty } from "@nestjs/swagger";

export class AccessTokenResponseDto {
  // Presente (sempre `false`) só na resposta de POST /auth/login - o caso
  // `true` devolve TwoFactorChallengeResponseDto no lugar (ver
  // AuthController.login). Ausente em /auth/refresh e /auth/switch-tenant,
  // que nunca produzem um desafio de 2FA - a ausência já significa "não".
  @ApiProperty({ enum: [false], required: false })
  twoFactorRequired?: false;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: "15m" })
  expiresIn!: string;
}
