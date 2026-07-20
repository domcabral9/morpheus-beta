import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

const ATTACHMENT_CATEGORIES = [
  "CONTRACT",
  "DPA",
  "SOC2_REPORT",
  "ISO27001_CERTIFICATE",
  "PENTEST_REPORT",
  "ARCHITECTURE_DOCUMENT",
  "DPIA",
  "PRIVACY_POLICY",
  "OTHER",
] as const;

export class UploadAttachmentDto {
  @ApiProperty({ enum: ATTACHMENT_CATEGORIES })
  @IsIn(ATTACHMENT_CATEGORIES)
  category!: (typeof ATTACHMENT_CATEGORIES)[number];

  @ApiPropertyOptional({
    description: "Obrigatório informar exatamente um: assessmentId OU inventoryItemId.",
  })
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventoryItemId?: string;
}

export { ATTACHMENT_CATEGORIES };
