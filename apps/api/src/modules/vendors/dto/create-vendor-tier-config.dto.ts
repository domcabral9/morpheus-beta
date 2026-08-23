import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateVendorTierConfigDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({
    default: false,
    description:
      "Se true, ativa esta configuração e desativa qualquer outra do tenant. Uma configuração precisa estar ativa para novas avaliações de fornecedor calcularem o tier.",
  })
  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
