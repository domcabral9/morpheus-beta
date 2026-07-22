import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

// logoUrl não entra aqui de propósito: desde a Etapa de upload real, esse
// campo é gerido só por POST /tenants/current/logo (multipart) — deixá-lo
// editável via PATCH JSON permitiria sobrescrever uma chave de storage válida
// com uma string arbitrária.
export class UpdateTenantDto {
  @ApiPropertyOptional({
    description: 'Nome da equipe exibido como autora do parecer (ex.: "SecOps").',
  })
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
