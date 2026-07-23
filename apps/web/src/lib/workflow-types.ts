import type { Criticality } from "@/lib/assessment-types";

export type WorkflowDecision = "APPROVE" | "REJECT" | "REQUEST_ADJUSTMENT" | "SKIP";

export type WorkflowStepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "ADJUSTMENT_REQUESTED"
  | "SKIPPED";

export interface InboxWorkflowStep {
  id: string;
  order: number;
  name: string;
  responsibleRoleId: string;
  slaHours: number;
  isOptional: boolean;
  requiresLgpd: boolean;
}

export interface InboxStepExecution {
  id: string;
  assessmentWorkflowInstanceId: string;
  workflowStepId: string;
  status: WorkflowStepStatus;
  comments: string | null;
  slaDueAt: string | null;
  createdAt: string;
  workflowStep: InboxWorkflowStep;
  assessmentWorkflowInstance: {
    id: string;
    assessmentId: string;
    currentStepOrder: number;
    assessment: {
      id: string;
      softwareName: string;
      vendor: string;
      criticality: Criticality;
      requesterId: string;
      hasRiskAnalysis: boolean;
      hasInfoSecClause: boolean;
    };
  };
}

export interface DecideStepPayload {
  decision: WorkflowDecision;
  comments?: string;
}

export interface BulkDecideStepsPayload {
  stepExecutionIds: string[];
  decision: WorkflowDecision;
  comments?: string;
}

export interface BulkDecideResult {
  stepExecutionId: string;
  success: boolean;
  error?: string;
}

export interface WorkflowHistoryStepExecution {
  id: string;
  status: WorkflowStepStatus;
  comments: string | null;
  decidedAt: string | null;
  slaDueAt: string | null;
  createdAt: string;
  workflowStep: { id: string; order: number; name: string; isOptional: boolean };
  assignedUser: { id: string; name: string; email: string } | null;
  decidedBy: { id: string; name: string; email: string } | null;
}

export interface WorkflowInstanceDetail {
  id: string;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED";
  currentStepOrder: number;
  stepExecutions: WorkflowHistoryStepExecution[];
}
