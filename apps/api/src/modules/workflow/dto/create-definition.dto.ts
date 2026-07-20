import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateWorkflowDefinitionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({
    default: false,
    description: "Se true, marca esta definição como padrão do tenant (desmarca as demais).",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
