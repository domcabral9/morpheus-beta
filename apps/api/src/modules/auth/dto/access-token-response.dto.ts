import { ApiProperty } from "@nestjs/swagger";

export class AccessTokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: "15m" })
  expiresIn!: string;
}
