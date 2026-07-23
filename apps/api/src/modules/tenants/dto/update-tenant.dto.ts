import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches, MinLength } from "class-validator";

const MM_DD_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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

  @ApiPropertyOptional({
    description: 'Início da janela de fechamento anual, formato "MM-DD" (ex.: "11-01").',
  })
  @IsOptional()
  @IsString()
  @Matches(MM_DD_PATTERN, { message: "annualClosingWindowStart deve estar no formato MM-DD." })
  annualClosingWindowStart?: string;

  @ApiPropertyOptional({
    description: 'Fim da janela de fechamento anual, formato "MM-DD" (ex.: "12-14").',
  })
  @IsOptional()
  @IsString()
  @Matches(MM_DD_PATTERN, { message: "annualClosingWindowEnd deve estar no formato MM-DD." })
  annualClosingWindowEnd?: string;

  @ApiPropertyOptional({
    description: "Se a janela de fechamento anual está habilitada para este tenant.",
  })
  @IsOptional()
  @IsBoolean()
  annualClosingWindowEnabled?: boolean;
}
