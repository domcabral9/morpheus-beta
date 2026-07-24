import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class ReassignRenewalRequesterDto {
  @ApiProperty({ description: "Usuário do tenant que passa a ser o solicitante do ciclo de renovação." })
  @IsString()
  @MinLength(1)
  newRequesterId!: string;

  @ApiPropertyOptional({ description: "Motivo da reatribuição (ex.: solicitante original saiu da empresa)." })
  @IsOptional()
  @IsString()
  reason?: string;
}
