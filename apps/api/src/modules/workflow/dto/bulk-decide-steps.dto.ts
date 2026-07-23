import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString } from "class-validator";
import { WORKFLOW_DECISIONS } from "./decide-step.dto";

const MAX_BULK_DECISIONS = 50;

export class BulkDecideStepsDto {
  @ApiProperty({ type: [String], description: "IDs de WorkflowStepExecution a decidir de uma vez." })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_DECISIONS)
  @ArrayUnique()
  @IsString({ each: true })
  stepExecutionIds!: string[];

  @ApiProperty({ enum: WORKFLOW_DECISIONS, description: "Mesma decisão aplicada a todas as etapas selecionadas." })
  @IsIn(WORKFLOW_DECISIONS)
  decision!: (typeof WORKFLOW_DECISIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export { MAX_BULK_DECISIONS };
