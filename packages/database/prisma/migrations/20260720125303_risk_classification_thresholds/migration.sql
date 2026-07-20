/*
  Warnings:

  - Added the required column `maxScore` to the `risk_classifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minScore` to the `risk_classifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "risk_classifications" ADD COLUMN     "maxScore" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "minScore" DECIMAL(5,2) NOT NULL;
