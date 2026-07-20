import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

const WORKFLOW_DECISIONS = ["APPROVE", "REJECT", "REQUEST_ADJUSTMENT", "SKIP"] as const;

export class DecideStepDto {
  @ApiProperty({ enum: WORKFLOW_DECISIONS })
  @IsIn(WORKFLOW_DECISIONS)
  decision!: (typeof WORKFLOW_DECISIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export { WORKFLOW_DECISIONS };
