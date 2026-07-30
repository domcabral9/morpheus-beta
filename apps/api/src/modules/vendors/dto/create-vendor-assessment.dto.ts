import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { VendorAnswerInputDto } from "./vendor-answer-input.dto";

/**
 * Usado tanto para criar (`POST .../assessments`, status nasce DRAFT) quanto
 * para editar um rascunho (`PATCH .../assessments/:id`) - respostas parciais
 * são válidas nos dois casos, a completude só é exigida na conclusão
 * (`POST .../assessments/:id/complete`).
 */
export class CreateVendorAssessmentDto {
  @ApiPropertyOptional({
    description: "VendorTierConfig a usar - se omitido, usa a config ativa do tenant.",
  })
  @IsOptional()
  @IsString()
  vendorTierConfigId?: string;

  @ApiPropertyOptional({ type: [VendorAnswerInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorAnswerInputDto)
  answers?: VendorAnswerInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
