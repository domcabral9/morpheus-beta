import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class UpdateIntegrationsPolicyDto {
  /** Omitido = preserva a chave já salva (não sobrescreve com vazio). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  virusTotalApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  virusTotalEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  virusTotalDailyBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  endoflifeEnabled?: boolean;
}
