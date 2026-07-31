-- CreateTable
CREATE TABLE "platform_password_policies" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "minLength" INTEGER NOT NULL DEFAULT 8,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "requireLowercase" BOOLEAN NOT NULL DEFAULT true,
    "requireDigit" BOOLEAN NOT NULL DEFAULT true,
    "requireSymbol" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_password_policies_pkey" PRIMARY KEY ("id")
);
