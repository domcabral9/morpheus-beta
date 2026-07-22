import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: "Papéis a atribuir. Ignorado se replicateRolesFromUserId vier." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({
    description: "Id de um usuário existente do tenant cujos papéis serão copiados para o novo.",
  })
  @IsOptional()
  @IsString()
  replicateRolesFromUserId?: string;
}
