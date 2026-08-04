import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class RequestPasswordlessLoginDto {
  @ApiProperty({ example: "demo", description: "Slug do tenant (organização)." })
  @IsString()
  tenantSlug!: string;

  @ApiProperty({ example: "admin@morpheus.demo" })
  @IsEmail()
  email!: string;
}
