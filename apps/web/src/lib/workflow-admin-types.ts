export interface RoleSummary {
  id: string;
  name: string;
}

export interface WorkflowStepAdmin {
  id: string;
  workflowDefinitionId: string;
  order: number;
  name: string;
  responsibleRoleId: string;
  slaHours: number;
  isOptional: boolean;
  requiresLgpd: boolean;
}

export interface WorkflowDefinitionAdmin {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStepAdmin[];
}
