-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('PAYMENT', 'INVOICE', 'PURCHASE_ORDER', 'CONTRACT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('STATE', 'EVENT');

-- CreateEnum
CREATE TYPE "NotificationEmailStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dedupeKey" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "eventType" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "customerName" TEXT,
    "companyName" TEXT,
    "invoiceNumber" TEXT,
    "poNumber" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "href" TEXT,
    "metadata" JSONB,
    "emailEligible" BOOLEAN NOT NULL DEFAULT false,
    "emailStatus" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "emailTemplateKey" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationReceipt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notificationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_category_occurredAt_idx" ON "Notification"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_occurredAt_idx" ON "Notification"("occurredAt");

-- CreateIndex
CREATE INDEX "Notification_kind_idx" ON "Notification"("kind");

-- CreateIndex
CREATE INDEX "Notification_emailStatus_idx" ON "Notification"("emailStatus");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationReceipt_notificationId_userId_key" ON "NotificationReceipt"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "NotificationReceipt_userId_deletedAt_readAt_idx" ON "NotificationReceipt"("userId", "deletedAt", "readAt");

-- CreateIndex
CREATE INDEX "NotificationReceipt_userId_createdAt_idx" ON "NotificationReceipt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "NotificationReceipt" ADD CONSTRAINT "NotificationReceipt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationReceipt" ADD CONSTRAINT "NotificationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notifications module for existing databases. Seed upserts the same route.
INSERT INTO "Module" ("id", "name", "description", "route", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Notifications', 'Dashboard notification centre', '/admin/notifications', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "Module" WHERE "route" = '/admin/notifications'
);

INSERT INTO "RoleModule" ("id", "roleId", "moduleId", "canView", "canCreate", "canEdit", "canDelete")
SELECT gen_random_uuid(), r."id", m."id", true, true, true, true
FROM "Role" r
JOIN "Module" m ON m."route" = '/admin/notifications'
WHERE r."name" ILIKE '%admin%'
AND NOT EXISTS (
    SELECT 1
    FROM "RoleModule" rm
    WHERE rm."roleId" = r."id"
      AND rm."moduleId" = m."id"
);
