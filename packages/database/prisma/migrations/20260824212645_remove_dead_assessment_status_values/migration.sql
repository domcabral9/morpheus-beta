-- Remove dead AssessmentStatus enum values SUBMITTED/REOPENED.
-- Confirmed via code audit (2026-08-08/2026-08-24): no service, scheduler, or
-- seed ever writes either value - submit() always writes IN_REVIEW directly,
-- and the annual-renewal arc reopens the same AssessmentWorkflowInstance via
-- PENDING_RENEWAL, never REOPENED. Zero rows in production/dev use either
-- value, so this is a pure enum-shrink, not a data migration.
BEGIN;

CREATE TYPE "AssessmentStatus_new" AS ENUM ('DRAFT', 'IN_REVIEW', 'PENDING_ADJUSTMENT', 'APPROVED', 'REJECTED', 'PENDING_RENEWAL');
ALTER TABLE "assessments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "assessments" ALTER COLUMN "status" TYPE "AssessmentStatus_new" USING ("status"::text::"AssessmentStatus_new");
ALTER TYPE "AssessmentStatus" RENAME TO "AssessmentStatus_old";
ALTER TYPE "AssessmentStatus_new" RENAME TO "AssessmentStatus";
DROP TYPE "AssessmentStatus_old";
ALTER TABLE "assessments" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

COMMIT;
