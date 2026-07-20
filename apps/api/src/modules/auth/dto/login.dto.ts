import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "demo", description: "Slug do tenant (organização)." })
  @IsString()
  tenantSlug!: string;

  @ApiProperty({ example: "admin@morpheus.demo" })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}
