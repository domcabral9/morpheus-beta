import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export class CreateVendorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ description: "CNPJ ou identificador fiscal equivalente." })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: CRITICALITY_VALUES,
    description: "Criticidade de negócio do fornecedor - ajusta a cadência de reavaliação.",
  })
  @IsOptional()
  @IsIn(CRITICALITY_VALUES)
  businessCriticality?: (typeof CRITICALITY_VALUES)[number];
}

export { CRITICALITY_VALUES };
