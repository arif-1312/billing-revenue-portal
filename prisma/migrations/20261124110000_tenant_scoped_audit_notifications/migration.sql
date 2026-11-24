ALTER TABLE "Notification" ADD COLUMN "companyId" UUID;
ALTER TABLE "AuditLog" ADD COLUMN "companyId" UUID;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notification_companyId_occurredAt_idx" ON "Notification"("companyId", "occurredAt");
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- Recover tenant ownership for historical notifications whose entity still
-- identifies an unambiguous company. Old global receipts for unassigned rows
-- remain hidden by the tenant-scoped notification queries.
UPDATE "Notification" n SET "companyId" = po."companyId"
FROM "PurchaseOrder" po
WHERE n."companyId" IS NULL AND n."entityType" = 'PurchaseOrder'
  AND po."id"::text = n."entityId" AND po."companyId" IS NOT NULL;

UPDATE "Notification" n SET "companyId" = p."companyId"
FROM "Project" p
WHERE n."companyId" IS NULL AND n."entityType" = 'Project'
  AND p."id"::text = n."entityId";

UPDATE "Notification" n SET "companyId" = c."companyId"
FROM "Customer" c
WHERE n."companyId" IS NULL AND n."entityType" = 'Customer'
  AND c."id"::text = n."entityId" AND c."companyId" IS NOT NULL;

UPDATE "Notification" n SET "companyId" = v."companyId"
FROM "Vendor" v
WHERE n."companyId" IS NULL AND n."entityType" = 'Vendor'
  AND v."id"::text = n."entityId" AND v."companyId" IS NOT NULL;

UPDATE "Notification" n SET "companyId" = cn."companyId"
FROM "CreditNote" cn
WHERE n."companyId" IS NULL AND n."entityType" = 'CreditNote'
  AND cn."id"::text = n."entityId" AND cn."companyId" IS NOT NULL;

UPDATE "Notification" n SET "companyId" = co."id"
FROM "Company" co
WHERE n."companyId" IS NULL AND n."entityType" = 'Company'
  AND co."id"::text = n."entityId";

-- Backfill auditable tenant records using their current parent ownership.
UPDATE "AuditLog" a SET "companyId" = po."companyId"
FROM "PurchaseOrder" po
WHERE a."companyId" IS NULL AND a."model" = 'PurchaseOrder'
  AND po."id"::text = a."recordId" AND po."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = p."companyId"
FROM "Project" p
WHERE a."companyId" IS NULL AND a."model" = 'Project'
  AND p."id"::text = a."recordId";

UPDATE "AuditLog" a SET "companyId" = c."companyId"
FROM "Customer" c
WHERE a."companyId" IS NULL AND a."model" = 'Customer'
  AND c."id"::text = a."recordId" AND c."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = v."companyId"
FROM "Vendor" v
WHERE a."companyId" IS NULL AND a."model" = 'Vendor'
  AND v."id"::text = a."recordId" AND v."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = st."companyId"
FROM "ServiceType" st
WHERE a."companyId" IS NULL AND a."model" = 'ServiceType'
  AND st."id"::text = a."recordId" AND st."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = bp."companyId"
FROM "BillingPlan" bp
WHERE a."companyId" IS NULL AND a."model" = 'BillingPlan'
  AND bp."id"::text = a."recordId" AND bp."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = cd."companyId"
FROM "ContractDuration" cd
WHERE a."companyId" IS NULL AND a."model" = 'ContractDuration'
  AND cd."id"::text = a."recordId" AND cd."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = ct."companyId"
FROM "ContractType" ct
WHERE a."companyId" IS NULL AND a."model" = 'ContractType'
  AND ct."id"::text = a."recordId" AND ct."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = cn."companyId"
FROM "CreditNote" cn
WHERE a."companyId" IS NULL AND a."model" = 'CreditNote'
  AND cn."id"::text = a."recordId" AND cn."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = co."id"
FROM "Company" co
WHERE a."companyId" IS NULL AND a."model" = 'Company'
  AND co."id"::text = a."recordId";

UPDATE "AuditLog" a SET "companyId" = po."companyId"
FROM "BillingCycle" bc JOIN "PurchaseOrder" po ON po."id" = bc."purchaseOrderId"
WHERE a."companyId" IS NULL AND a."model" = 'BillingCycle'
  AND bc."id"::text = a."recordId" AND po."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = po."companyId"
FROM "BillingCyclePayment" bcp
JOIN "BillingCycle" bc ON bc."id" = bcp."billingCycleId"
JOIN "PurchaseOrder" po ON po."id" = bc."purchaseOrderId"
WHERE a."companyId" IS NULL AND a."model" = 'BillingCyclePayment'
  AND bcp."id"::text = a."recordId" AND po."companyId" IS NOT NULL;

UPDATE "AuditLog" a SET "companyId" = p."companyId"
FROM "ProjectMonthlyPL" pl JOIN "Project" p ON p."id" = pl."projectId"
WHERE a."companyId" IS NULL AND a."model" = 'ProjectMonthlyPL'
  AND pl."id"::text = a."recordId";

-- Stop pre-existing tenant notification email jobs from reaching users who do
-- not have an active membership in the notification's company.
UPDATE "EmailJob" ej
SET "status" = 'FAILED'::"EmailJobStatus",
    "lastError" = 'Notification recipient was not authorized for its company.',
    "lastAttemptAt" = CURRENT_TIMESTAMP,
    "lockedAt" = NULL,
    "lockToken" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Notification" n
WHERE ej."notificationId" = n."id"
  AND ej."status" IN ('PENDING'::"EmailJobStatus", 'RETRYING'::"EmailJobStatus", 'PROCESSING'::"EmailJobStatus")
  AND (
    n."companyId" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "UserCompany" uc
      JOIN "Company" c ON c."id" = uc."companyId"
      JOIN "User" u ON u."id" = uc."userId"
      JOIN "Role" r ON r."id" = uc."roleId"
      WHERE uc."companyId" = n."companyId"
        AND uc."userId" = ej."recipientUserId"
        AND uc."status" = 'ACTIVE'::"Status"
        AND c."status" = 'ACTIVE'::"CompanyStatus"
        AND c."isActive" = true
        AND u."status" = 'ACTIVE'::"Status"
        AND r."status" = 'ACTIVE'::"Status"
    )
  );
