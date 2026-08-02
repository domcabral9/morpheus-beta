import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class EnableTwoFactorDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "Código deve ter exatamente 6 dígitos." })
  code!: string;
}
