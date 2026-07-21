import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: "URL do logo exibido no cabeçalho do parecer técnico em PDF." })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Nome da equipe exibido como autora do parecer (ex.: "SecOps").' })
  @IsOptional()
  @IsString()
  securityTeamName?: string;

  @ApiPropertyOptional({
    description: 'Prefixo do número sequencial do parecer (ex.: "SECOPS-SW").',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  opinionNumberPrefix?: string;
}
