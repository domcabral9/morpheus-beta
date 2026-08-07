import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ComplianceOverviewQueryDto {
  /** Escoa a visão pra um único fornecedor ("Fornecedor específico" no frontend). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string;
}
