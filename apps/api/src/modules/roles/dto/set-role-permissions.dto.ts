import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class SetRolePermissionsDto {
  @ApiProperty({ description: "Substitui por completo o conjunto de permissões do papel. Pode ser vazio." })
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}
