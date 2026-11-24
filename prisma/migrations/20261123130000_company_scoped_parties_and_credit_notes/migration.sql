ALTER TABLE "Customer" ADD COLUMN "companyId" UUID;
ALTER TABLE "Vendor" ADD COLUMN "companyId" UUID;
ALTER TABLE "CreditNote" ADD COLUMN "companyId" UUID;

-- Backfill party ownership only when its existing purchase orders identify a
-- single company. Ambiguous/unlinked records remain unassigned and are hidden
-- until an administrator explicitly reconciles them.
WITH "CustomerOwners" AS (
  SELECT "customerId", MIN("companyId"::text)::uuid AS "companyId"
  FROM "PurchaseOrder"
  WHERE "customerId" IS NOT NULL AND "companyId" IS NOT NULL
  GROUP BY "customerId"
  HAVING COUNT(DISTINCT "companyId") = 1
)
UPDATE "Customer" c SET "companyId" = owners."companyId"
FROM "CustomerOwners" owners WHERE c."id" = owners."customerId";

WITH "VendorOwners" AS (
  SELECT "vendorId", MIN("companyId"::text)::uuid AS "companyId"
  FROM "PurchaseOrder"
  WHERE "vendorId" IS NOT NULL AND "companyId" IS NOT NULL
  GROUP BY "vendorId"
  HAVING COUNT(DISTINCT "companyId") = 1
)
UPDATE "Vendor" v SET "companyId" = owners."companyId"
FROM "VendorOwners" owners WHERE v."id" = owners."vendorId";

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");
CREATE INDEX "Vendor_companyId_idx" ON "Vendor"("companyId");
CREATE INDEX "CreditNote_companyId_date_idx" ON "CreditNote"("companyId", "date");
