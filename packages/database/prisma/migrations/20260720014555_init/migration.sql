-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'SCALE', 'TEXT');

-- CreateEnum
CREATE TYPE "RiskDimension" AS ENUM ('PROBABILITY', 'IMPACT', 'BOTH');

-- CreateEnum
CREATE TYPE "ControlFrameworkCode" AS ENUM ('ISO_27001', 'ISO_27002', 'NIST_CSF', 'CIS_V8', 'LGPD', 'GDPR', 'OWASP_ASVS', 'OWASP_TOP10');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'ADJUSTMENT_REQUESTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PENDING_ADJUSTMENT', 'APPROVED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "SoftwareType" AS ENUM ('SAAS', 'ON_PREMISES', 'DESKTOP', 'MOBILE');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'EXPIRED', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('CONTRACT', 'DPA', 'SOC2_REPORT', 'ISO27001_CERTIFICATE', 'PENTEST_REPORT', 'ARCHITECTURE_DOCUMENT', 'DPIA', 'PRIVACY_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'DOWNLOAD', 'APPROVE', 'REJECT', 'REOPEN', 'SUBMIT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_REQUEST', 'APPROVAL', 'REJECTION', 'ADJUSTMENT_REQUEST', 'HOMOLOGATION_EXPIRING', 'NEW_COMMENT', 'OPINION_ISSUED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "ssoSubject" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "question_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "type" "QuestionType" NOT NULL,
    "riskDimension" "RiskDimension" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_frameworks" (
    "id" TEXT NOT NULL,
    "code" "ControlFrameworkCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "control_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_controls" (
    "questionId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "question_controls_pkey" PRIMARY KEY ("questionId","controlId")
);

-- CreateTable
CREATE TABLE "risk_matrix_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minApprovalScore" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_matrix_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probability_levels" (
    "id" TEXT NOT NULL,
    "riskMatrixConfigId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "minScore" DECIMAL(5,2) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "probability_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_levels" (
    "id" TEXT NOT NULL,
    "riskMatrixConfigId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "minScore" DECIMAL(5,2) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "impact_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_classifications" (
    "id" TEXT NOT NULL,
    "riskMatrixConfigId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "recommendationText" TEXT,

    CONSTRAINT "risk_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_matrix_cells" (
    "id" TEXT NOT NULL,
    "riskMatrixConfigId" TEXT NOT NULL,
    "probabilityLevelId" TEXT NOT NULL,
    "impactLevelId" TEXT NOT NULL,
    "riskClassificationId" TEXT NOT NULL,

    CONSTRAINT "risk_matrix_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "responsibleRoleId" TEXT NOT NULL,
    "slaHours" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "requiresLgpd" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_workflow_instances" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "currentStepOrder" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_executions" (
    "id" TEXT NOT NULL,
    "assessmentWorkflowInstanceId" TEXT NOT NULL,
    "workflowStepId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "softwareName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "url" TEXT,
    "responsibleId" TEXT NOT NULL,
    "requestingArea" TEXT NOT NULL,
    "criticality" "Criticality" NOT NULL,
    "justification" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "textValue" TEXT,
    "scaleValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answer_options" (
    "id" TEXT NOT NULL,
    "assessmentAnswerId" TEXT NOT NULL,
    "questionOptionId" TEXT NOT NULL,

    CONSTRAINT "assessment_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_versions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "changeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_results" (
    "id" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "riskMatrixConfigId" TEXT NOT NULL,
    "probabilityScore" DECIMAL(5,2) NOT NULL,
    "impactScore" DECIMAL(5,2) NOT NULL,
    "totalScore" DECIMAL(5,2) NOT NULL,
    "probabilityLevelId" TEXT NOT NULL,
    "impactLevelId" TEXT NOT NULL,
    "riskClassificationId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_recommendations" (
    "id" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_opinions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "qrCodeData" TEXT NOT NULL,
    "classificationLabel" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT NOT NULL,

    CONSTRAINT "technical_opinions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_inventory_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "version" TEXT,
    "url" TEXT,
    "category" TEXT NOT NULL,
    "type" "SoftwareType" NOT NULL,
    "requestingArea" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "technicalResponsibleId" TEXT NOT NULL,
    "homologationDate" TIMESTAMP(3) NOT NULL,
    "nextReviewDate" TIMESTAMP(3) NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "criticality" "Criticality" NOT NULL,
    "dataClassification" "DataClassification" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "software_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "inventoryItemId" TEXT,
    "category" "AttachmentCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "question_categories_tenantId_idx" ON "question_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "question_categories_tenantId_name_key" ON "question_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "questions_tenantId_idx" ON "questions"("tenantId");

-- CreateIndex
CREATE INDEX "questions_categoryId_idx" ON "questions"("categoryId");

-- CreateIndex
CREATE INDEX "question_options_questionId_idx" ON "question_options"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "control_frameworks_code_key" ON "control_frameworks"("code");

-- CreateIndex
CREATE INDEX "controls_frameworkId_idx" ON "controls"("frameworkId");

-- CreateIndex
CREATE UNIQUE INDEX "controls_frameworkId_code_key" ON "controls"("frameworkId", "code");

-- CreateIndex
CREATE INDEX "risk_matrix_configs_tenantId_idx" ON "risk_matrix_configs"("tenantId");

-- CreateIndex
CREATE INDEX "probability_levels_riskMatrixConfigId_idx" ON "probability_levels"("riskMatrixConfigId");

-- CreateIndex
CREATE INDEX "impact_levels_riskMatrixConfigId_idx" ON "impact_levels"("riskMatrixConfigId");

-- CreateIndex
CREATE INDEX "risk_classifications_riskMatrixConfigId_idx" ON "risk_classifications"("riskMatrixConfigId");

-- CreateIndex
CREATE INDEX "risk_matrix_cells_riskMatrixConfigId_idx" ON "risk_matrix_cells"("riskMatrixConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_matrix_cells_probabilityLevelId_impactLevelId_key" ON "risk_matrix_cells"("probabilityLevelId", "impactLevelId");

-- CreateIndex
CREATE INDEX "recommendations_tenantId_idx" ON "recommendations"("tenantId");

-- CreateIndex
CREATE INDEX "workflow_definitions_tenantId_idx" ON "workflow_definitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_tenantId_name_key" ON "workflow_definitions"("tenantId", "name");

-- CreateIndex
CREATE INDEX "workflow_steps_workflowDefinitionId_idx" ON "workflow_steps"("workflowDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_workflowDefinitionId_order_key" ON "workflow_steps"("workflowDefinitionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_workflow_instances_assessmentId_key" ON "assessment_workflow_instances"("assessmentId");

-- CreateIndex
CREATE INDEX "workflow_step_executions_assessmentWorkflowInstanceId_idx" ON "workflow_step_executions"("assessmentWorkflowInstanceId");

-- CreateIndex
CREATE INDEX "assessments_tenantId_idx" ON "assessments"("tenantId");

-- CreateIndex
CREATE INDEX "assessments_tenantId_status_idx" ON "assessments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "assessment_answers_assessmentId_idx" ON "assessment_answers"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_assessmentId_questionId_key" ON "assessment_answers"("assessmentId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answer_options_assessmentAnswerId_questionOption_key" ON "assessment_answer_options"("assessmentAnswerId", "questionOptionId");

-- CreateIndex
CREATE INDEX "assessment_versions_assessmentId_idx" ON "assessment_versions"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_versions_assessmentId_versionLabel_key" ON "assessment_versions"("assessmentId", "versionLabel");

-- CreateIndex
CREATE UNIQUE INDEX "risk_results_assessmentVersionId_key" ON "risk_results"("assessmentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_recommendations_assessmentVersionId_recommendati_key" ON "assessment_recommendations"("assessmentVersionId", "recommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "technical_opinions_assessmentVersionId_key" ON "technical_opinions"("assessmentVersionId");

-- CreateIndex
CREATE INDEX "technical_opinions_tenantId_idx" ON "technical_opinions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "technical_opinions_tenantId_number_key" ON "technical_opinions"("tenantId", "number");

-- CreateIndex
CREATE INDEX "software_inventory_items_tenantId_idx" ON "software_inventory_items"("tenantId");

-- CreateIndex
CREATE INDEX "software_inventory_items_tenantId_status_idx" ON "software_inventory_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "software_inventory_items_nextReviewDate_idx" ON "software_inventory_items"("nextReviewDate");

-- CreateIndex
CREATE INDEX "attachments_tenantId_idx" ON "attachments"("tenantId");

-- CreateIndex
CREATE INDEX "attachments_assessmentId_idx" ON "attachments"("assessmentId");

-- CreateIndex
CREATE INDEX "attachments_inventoryItemId_idx" ON "attachments"("inventoryItemId");

-- CreateIndex
CREATE INDEX "comments_tenantId_idx" ON "comments"("tenantId");

-- CreateIndex
CREATE INDEX "comments_assessmentId_idx" ON "comments"("assessmentId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "question_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "control_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_controls" ADD CONSTRAINT "question_controls_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_controls" ADD CONSTRAINT "question_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_matrix_configs" ADD CONSTRAINT "risk_matrix_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probability_levels" ADD CONSTRAINT "probability_levels_riskMatrixConfigId_fkey" FOREIGN KEY ("riskMatrixConfigId") REFERENCES "risk_matrix_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_levels" ADD CONSTRAINT "impact_levels_riskMatrixConfigId_fkey" FOREIGN KEY ("riskMatrixConfigId") REFERENCES "risk_matrix_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_classifications" ADD CONSTRAINT "risk_classifications_riskMatrixConfigId_fkey" FOREIGN KEY ("riskMatrixConfigId") REFERENCES "risk_matrix_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_matrix_cells" ADD CONSTRAINT "risk_matrix_cells_riskMatrixConfigId_fkey" FOREIGN KEY ("riskMatrixConfigId") REFERENCES "risk_matrix_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_matrix_cells" ADD CONSTRAINT "risk_matrix_cells_probabilityLevelId_fkey" FOREIGN KEY ("probabilityLevelId") REFERENCES "probability_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_matrix_cells" ADD CONSTRAINT "risk_matrix_cells_impactLevelId_fkey" FOREIGN KEY ("impactLevelId") REFERENCES "impact_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_matrix_cells" ADD CONSTRAINT "risk_matrix_cells_riskClassificationId_fkey" FOREIGN KEY ("riskClassificationId") REFERENCES "risk_classifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_triggerOptionId_fkey" FOREIGN KEY ("triggerOptionId") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_responsibleRoleId_fkey" FOREIGN KEY ("responsibleRoleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_workflow_instances" ADD CONSTRAINT "assessment_workflow_instances_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_workflow_instances" ADD CONSTRAINT "assessment_workflow_instances_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_assessmentWorkflowInstanceId_fkey" FOREIGN KEY ("assessmentWorkflowInstanceId") REFERENCES "assessment_workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "workflow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answer_options" ADD CONSTRAINT "assessment_answer_options_assessmentAnswerId_fkey" FOREIGN KEY ("assessmentAnswerId") REFERENCES "assessment_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answer_options" ADD CONSTRAINT "assessment_answer_options_questionOptionId_fkey" FOREIGN KEY ("questionOptionId") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_results" ADD CONSTRAINT "risk_results_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_results" ADD CONSTRAINT "risk_results_riskMatrixConfigId_fkey" FOREIGN KEY ("riskMatrixConfigId") REFERENCES "risk_matrix_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_results" ADD CONSTRAINT "risk_results_probabilityLevelId_fkey" FOREIGN KEY ("probabilityLevelId") REFERENCES "probability_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_results" ADD CONSTRAINT "risk_results_impactLevelId_fkey" FOREIGN KEY ("impactLevelId") REFERENCES "impact_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_results" ADD CONSTRAINT "risk_results_riskClassificationId_fkey" FOREIGN KEY ("riskClassificationId") REFERENCES "risk_classifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_recommendations" ADD CONSTRAINT "assessment_recommendations_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_recommendations" ADD CONSTRAINT "assessment_recommendations_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_opinions" ADD CONSTRAINT "technical_opinions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_opinions" ADD CONSTRAINT "technical_opinions_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "assessment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_opinions" ADD CONSTRAINT "technical_opinions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_inventory_items" ADD CONSTRAINT "software_inventory_items_technicalResponsibleId_fkey" FOREIGN KEY ("technicalResponsibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "software_inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
