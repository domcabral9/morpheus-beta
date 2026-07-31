import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, Max, Min } from "class-validator";

/**
 * Substitui o objeto inteiro (todos os campos obrigatórios) - evita
 * ambiguidade de "toggle não enviado significa não mexer ou desligar?" numa
 * configuração de segurança.
 */
export class UpdatePasswordPolicyDto {
  @ApiProperty({ minimum: 8, maximum: 128 })
  @IsInt()
  @Min(8)
  @Max(128)
  minLength!: number;

  @ApiProperty()
  @IsBoolean()
  requireUppercase!: boolean;

  @ApiProperty()
  @IsBoolean()
  requireLowercase!: boolean;

  @ApiProperty()
  @IsBoolean()
  requireDigit!: boolean;

  @ApiProperty()
  @IsBoolean()
  requireSymbol!: boolean;
}
