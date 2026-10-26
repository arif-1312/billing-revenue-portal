-- Additive security columns and shared rate-limit storage.
-- Money columns change type in place; existing values are rounded to paise.

ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Role"
SET "isSystem" = true
WHERE "name" = 'Admin';

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "poAmount" TYPE DECIMAL(14, 2)
  USING CASE
    WHEN "poAmount" IS NULL THEN NULL
    ELSE ROUND("poAmount"::numeric, 2)
  END;

ALTER TABLE "BillingCycle"
  ALTER COLUMN "invoiceAmount" TYPE DECIMAL(14, 2)
  USING CASE
    WHEN "invoiceAmount" IS NULL THEN NULL
    ELSE ROUND("invoiceAmount"::numeric, 2)
  END;

ALTER TABLE "BillingCycle"
  ALTER COLUMN "collectedAmount" TYPE DECIMAL(14, 2)
  USING CASE
    WHEN "collectedAmount" IS NULL THEN NULL
    ELSE ROUND("collectedAmount"::numeric, 2)
  END;

ALTER TABLE "BillingCyclePayment"
  ALTER COLUMN "amount" TYPE DECIMAL(14, 2)
  USING ROUND("amount"::numeric, 2);

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
