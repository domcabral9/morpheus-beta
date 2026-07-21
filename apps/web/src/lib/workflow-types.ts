import type { Criticality } from "@/lib/assessment-types";

export type WorkflowDecision = "APPROVE" | "REJECT" | "REQUEST_ADJUSTMENT" | "SKIP";

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
  status: "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "ADJUSTMENT_REQUESTED" | "SKIPPED";
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
      criticality: Criticality;
      requesterId: string;
    };
  };
}

export interface DecideStepPayload {
  decision: WorkflowDecision;
  comments?: string;
}
