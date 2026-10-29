CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "particulars" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vchType" TEXT NOT NULL,
    "vchNo" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditNote_date_idx" ON "CreditNote"("date");

CREATE INDEX "CreditNote_vchType_vchNo_idx" ON "CreditNote"("vchType", "vchNo");

INSERT INTO "Module" ("id", "name", "description", "route", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Credit Note', 'Credit notes', '/admin/credit-note', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "Module" WHERE "route" = '/admin/credit-note'
);

INSERT INTO "RoleModule" ("id", "roleId", "moduleId", "canView", "canCreate", "canEdit", "canDelete")
SELECT gen_random_uuid(), role."id", module."id", true, true, true, true
FROM "Role" role
JOIN "Module" module ON module."route" = '/admin/credit-note'
WHERE role."name" = 'Admin'
  AND NOT EXISTS (
    SELECT 1
    FROM "RoleModule" existing
    WHERE existing."roleId" = role."id"
      AND existing."moduleId" = module."id"
  );
