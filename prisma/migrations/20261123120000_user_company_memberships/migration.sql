ALTER TABLE "Company" ADD COLUMN "logo" TEXT;

CREATE TABLE "UserCompany" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");
CREATE INDEX "UserCompany_companyId_status_idx" ON "UserCompany"("companyId", "status");
CREATE INDEX "UserCompany_userId_status_idx" ON "UserCompany"("userId", "status");

ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve trusted system-administrator access. Other users receive no implicit
-- company access and must be assigned through the user-company access controls.
INSERT INTO "UserCompany" ("id", "userId", "companyId", "roleId", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."id", c."id", u."roleId", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
JOIN "Role" r ON r."id" = u."roleId" AND r."isSystem" = true AND r."status" = 'ACTIVE'
CROSS JOIN "Company" c
WHERE u."status" = 'ACTIVE' AND c."isActive" = true AND c."status" = 'ACTIVE'
ON CONFLICT ("userId", "companyId") DO NOTHING;
