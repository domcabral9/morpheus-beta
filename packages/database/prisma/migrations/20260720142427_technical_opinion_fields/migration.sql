-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "installerFileHash" TEXT,
ADD COLUMN     "linkedTicket" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "opinionNumberPrefix" TEXT NOT NULL DEFAULT 'SECOPS-SW',
ADD COLUMN     "securityTeamName" TEXT;
