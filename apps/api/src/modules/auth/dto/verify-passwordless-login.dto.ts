import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches } from "class-validator";

export class VerifyPasswordlessLoginDto {
  @ApiProperty({ example: "demo", description: "Slug do tenant (organização)." })
  @IsString()
  tenantSlug!: string;

  @ApiProperty({ example: "admin@morpheus.demo" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "Código deve ter exatamente 6 dígitos." })
  code!: string;
}
