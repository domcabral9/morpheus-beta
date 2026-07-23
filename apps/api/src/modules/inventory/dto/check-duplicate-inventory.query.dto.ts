import { IsNotEmpty, IsString } from "class-validator";

export class CheckDuplicateInventoryQueryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  areaId!: string;
}
