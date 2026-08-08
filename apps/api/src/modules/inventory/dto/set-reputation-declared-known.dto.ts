import { IsBoolean } from "class-validator";

export class SetReputationDeclaredKnownDto {
  @IsBoolean()
  declaredKnown!: boolean;
}
