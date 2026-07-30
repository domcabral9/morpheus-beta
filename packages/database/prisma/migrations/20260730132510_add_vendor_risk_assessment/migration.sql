-- CreateEnum
CREATE TYPE "VendorAssessmentStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_REASSESSMENT_DUE';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contractReference" TEXT,
    "notes" TEXT,
    "businessCriticality" "Criticality",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "currentTier" INTEGER,
    "currentTierLabel" TEXT,
    "currentScore" DECIMAL(5,2),
    "lastAssessedAt" TIMESTAMP(3),
    "nextReviewDueAt" TIMESTAMP(3),
    "reassessmentNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_question_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_questions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "type" "QuestionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_tier_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_tier_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_tier_thresholds" (
    "id" TEXT NOT NULL,
    "vendorTierConfigId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "minScore" DECIMAL(5,2) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,
    "baseReassessmentMonths" INTEGER NOT NULL,

    CONSTRAINT "vendor_tier_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "vendorTierConfigId" TEXT NOT NULL,
    "status" "VendorAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalScore" DECIMAL(5,2),
    "tier" INTEGER,
    "tierLabel" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "nextReviewDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_answers" (
    "id" TEXT NOT NULL,
    "vendorAssessmentId" TEXT NOT NULL,
    "vendorQuestionId" TEXT NOT NULL,
    "textValue" TEXT,
    "scaleValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_answer_options" (
    "id" TEXT NOT NULL,
    "vendorAnswerId" TEXT NOT NULL,
    "vendorQuestionOptionId" TEXT NOT NULL,

    CONSTRAINT "vendor_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenantId_name_key" ON "vendors"("tenantId", "name");

-- CreateIndex
CREATE INDEX "vendor_question_categories_tenantId_idx" ON "vendor_question_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_question_categories_tenantId_name_key" ON "vendor_question_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "vendor_questions_tenantId_idx" ON "vendor_questions"("tenantId");

-- CreateIndex
CREATE INDEX "vendor_questions_categoryId_idx" ON "vendor_questions"("categoryId");

-- CreateIndex
CREATE INDEX "vendor_question_options_questionId_idx" ON "vendor_question_options"("questionId");

-- CreateIndex
CREATE INDEX "vendor_tier_configs_tenantId_idx" ON "vendor_tier_configs"("tenantId");

-- CreateIndex
CREATE INDEX "vendor_tier_thresholds_vendorTierConfigId_idx" ON "vendor_tier_thresholds"("vendorTierConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_tier_thresholds_vendorTierConfigId_tier_key" ON "vendor_tier_thresholds"("vendorTierConfigId", "tier");

-- CreateIndex
CREATE INDEX "vendor_assessments_tenantId_vendorId_idx" ON "vendor_assessments"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_answers_vendorAssessmentId_idx" ON "vendor_answers"("vendorAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_answers_vendorAssessmentId_vendorQuestionId_key" ON "vendor_answers"("vendorAssessmentId", "vendorQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_answer_options_vendorAnswerId_vendorQuestionOptionId_key" ON "vendor_answer_options"("vendorAnswerId", "vendorQuestionOptionId");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_question_categories" ADD CONSTRAINT "vendor_question_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_questions" ADD CONSTRAINT "vendor_questions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_questions" ADD CONSTRAINT "vendor_questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_question_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_question_options" ADD CONSTRAINT "vendor_question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "vendor_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_tier_configs" ADD CONSTRAINT "vendor_tier_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_tier_thresholds" ADD CONSTRAINT "vendor_tier_thresholds_vendorTierConfigId_fkey" FOREIGN KEY ("vendorTierConfigId") REFERENCES "vendor_tier_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_assessments" ADD CONSTRAINT "vendor_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_assessments" ADD CONSTRAINT "vendor_assessments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_assessments" ADD CONSTRAINT "vendor_assessments_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_assessments" ADD CONSTRAINT "vendor_assessments_vendorTierConfigId_fkey" FOREIGN KEY ("vendorTierConfigId") REFERENCES "vendor_tier_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_answers" ADD CONSTRAINT "vendor_answers_vendorAssessmentId_fkey" FOREIGN KEY ("vendorAssessmentId") REFERENCES "vendor_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_answers" ADD CONSTRAINT "vendor_answers_vendorQuestionId_fkey" FOREIGN KEY ("vendorQuestionId") REFERENCES "vendor_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_answer_options" ADD CONSTRAINT "vendor_answer_options_vendorAnswerId_fkey" FOREIGN KEY ("vendorAnswerId") REFERENCES "vendor_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_answer_options" ADD CONSTRAINT "vendor_answer_options_vendorQuestionOptionId_fkey" FOREIGN KEY ("vendorQuestionOptionId") REFERENCES "vendor_question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
