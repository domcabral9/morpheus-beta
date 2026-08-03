import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class ApproveInventoryApprovalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectInventoryApprovalDto {
  @ApiProperty({ description: "Motivo da reprovação — obrigatório, exibido ao criador do item." })
  @IsString()
  @MinLength(1)
  notes!: string;
}
