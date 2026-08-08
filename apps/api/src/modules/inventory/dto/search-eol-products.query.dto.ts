import { IsNotEmpty, IsString } from "class-validator";

export class SearchEolProductsQueryDto {
  @IsString()
  @IsNotEmpty()
  search!: string;
}
