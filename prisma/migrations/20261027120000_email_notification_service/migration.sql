-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCategorySetting" (
    "category" "NotificationCategory" NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCategorySetting_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotencyKey" TEXT NOT NULL,
    "notificationId" UUID,
    "eventKey" TEXT NOT NULL,
    "recipientUserId" UUID,
    "recipientEmail" TEXT NOT NULL,
    "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_idempotencyKey_key" ON "EmailJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailJob_status_nextAttemptAt_idx" ON "EmailJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailJob_notificationId_idx" ON "EmailJob"("notificationId");

-- CreateIndex
CREATE INDEX "EmailJob_recipientUserId_idx" ON "EmailJob"("recipientUserId");

-- CreateIndex
CREATE INDEX "EmailJob_createdAt_idx" ON "EmailJob"("createdAt");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EmailCategorySetting" ("category", "emailEnabled", "updatedAt")
VALUES
    ('PAYMENT', true, CURRENT_TIMESTAMP),
    ('INVOICE', true, CURRENT_TIMESTAMP),
    ('PURCHASE_ORDER', true, CURRENT_TIMESTAMP),
    ('CONTRACT', true, CURRENT_TIMESTAMP),
    ('SYSTEM', true, CURRENT_TIMESTAMP)
ON CONFLICT ("category") DO NOTHING;

INSERT INTO "Module" ("id", "name", "description", "route", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Email', 'Email delivery settings and logs', '/admin/email', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "Module" WHERE "route" = '/admin/email'
);

INSERT INTO "RoleModule" ("id", "roleId", "moduleId", "canView", "canCreate", "canEdit", "canDelete")
SELECT gen_random_uuid(), r."id", m."id", true, true, true, true
FROM "Role" r
JOIN "Module" m ON m."route" = '/admin/email'
WHERE r."name" ILIKE '%admin%'
AND NOT EXISTS (
    SELECT 1
    FROM "RoleModule" rm
    WHERE rm."roleId" = r."id"
      AND rm."moduleId" = m."id"
);
