import { IsOptional, IsString } from "class-validator";

export class LinkEolProductDto {
  /** `null`/omitido desvincula o produto atual. */
  @IsOptional()
  @IsString()
  eolProductId?: string | null;
}
