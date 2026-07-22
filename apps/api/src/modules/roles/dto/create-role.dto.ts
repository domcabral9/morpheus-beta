import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Permission keys a atribuir. Ignorado se replicateFromRoleId vier." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  @ApiPropertyOptional({
    description: "Id de um papel existente do tenant cujas permissões serão copiadas para o novo.",
  })
  @IsOptional()
  @IsString()
  replicateFromRoleId?: string;
}
