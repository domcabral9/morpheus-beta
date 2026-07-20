import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class LinkControlDto {
  @ApiProperty()
  @IsString()
  controlId!: string;
}
