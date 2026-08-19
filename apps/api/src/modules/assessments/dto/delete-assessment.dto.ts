import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class DeleteAssessmentDto {
  @ApiPropertyOptional({
    description:
      "Também exclui o fornecedor vinculado, se (e só se) ele ainda for genuinamente órfão " +
      "no momento da exclusão (ver GET :id/deletion-info). Ignorado silenciosamente se o " +
      "fornecedor já não for mais elegível.",
  })
  @IsOptional()
  @IsBoolean()
  deleteVendor?: boolean;
}
