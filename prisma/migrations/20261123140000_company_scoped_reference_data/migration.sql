ALTER TABLE "ServiceType" ADD COLUMN "companyId" UUID;
ALTER TABLE "BillingPlan" ADD COLUMN "companyId" UUID;
ALTER TABLE "ContractDuration" ADD COLUMN "companyId" UUID;
ALTER TABLE "ContractType" ADD COLUMN "companyId" UUID;

-- Attribute legacy setup data only where existing financial records point to
-- exactly one company. Shared or unused records stay hidden until reconciled.
WITH "ServiceTypeOwners" AS (
  SELECT "serviceTypeId", MIN("companyId"::text)::uuid AS "companyId"
  FROM "PurchaseOrder"
  WHERE "serviceTypeId" IS NOT NULL AND "companyId" IS NOT NULL
  GROUP BY "serviceTypeId"
  HAVING COUNT(DISTINCT "companyId") = 1
)
UPDATE "ServiceType" st SET "companyId" = owners."companyId"
FROM "ServiceTypeOwners" owners WHERE st."id" = owners."serviceTypeId";

WITH "BillingPlanUsage" AS (
  SELECT "billingPlanId", "companyId" FROM "PurchaseOrder"
  WHERE "billingPlanId" IS NOT NULL AND "companyId" IS NOT NULL
  UNION ALL
  SELECT "billingPlanId", "companyId" FROM "Project"
  WHERE "billingPlanId" IS NOT NULL AND "companyId" IS NOT NULL
), "BillingPlanOwners" AS (
  SELECT "billingPlanId", MIN("companyId"::text)::uuid AS "companyId"
  FROM "BillingPlanUsage"
  GROUP BY "billingPlanId"
  HAVING COUNT(DISTINCT "companyId") = 1
)
UPDATE "BillingPlan" bp SET "companyId" = owners."companyId"
FROM "BillingPlanOwners" owners WHERE bp."id" = owners."billingPlanId";

WITH "ContractDurationOwners" AS (
  SELECT "contractDurationId", MIN("companyId"::text)::uuid AS "companyId"
  FROM "PurchaseOrder"
  WHERE "contractDurationId" IS NOT NULL AND "companyId" IS NOT NULL
  GROUP BY "contractDurationId"
  HAVING COUNT(DISTINCT "companyId") = 1
)
UPDATE "ContractDuration" cd SET "companyId" = owners."companyId"
FROM "ContractDurationOwners" owners WHERE cd."id" = owners."contractDurationId";

WITH "ContractTypeOwners" AS (
  SELECT "contractId", MIN("companyId"::text)::uuid AS "companyId"
  FROM "PurchaseOrder"
  WHERE "contractId" IS NOT NULL AND "companyId" IS NOT NULL
  GROUP BY "contractId"
  HAVING COUNT(DISTINCT "companyId") = 1
)
UPDATE "ContractType" ct SET "companyId" = owners."companyId"
FROM "ContractTypeOwners" owners WHERE ct."id" = owners."contractId";

ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractDuration" ADD CONSTRAINT "ContractDuration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractType" ADD CONSTRAINT "ContractType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ServiceType_companyId_idx" ON "ServiceType"("companyId");
CREATE INDEX "BillingPlan_companyId_idx" ON "BillingPlan"("companyId");
CREATE INDEX "ContractDuration_companyId_idx" ON "ContractDuration"("companyId");
CREATE INDEX "ContractType_companyId_idx" ON "ContractType"("companyId");
