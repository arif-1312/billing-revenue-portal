-- Add missing application modules without changing existing permissions or status.
WITH required("name", "route") AS (VALUES
  ('Dashboard', '/admin/dashboard'),
  ('P&L', '/admin/pl'),
  ('Contract Type', '/admin/contract-type'),
  ('Service Type', '/admin/service-type'),
  ('Billing Plan', '/admin/billing-plan'),
  ('Contract Duration', '/admin/contract-duration'),
  ('Customer', '/admin/customer'),
  ('Vendor', '/admin/vendor'),
  ('Company', '/admin/company'),
  ('Users', '/admin/users'),
  ('Roles', '/admin/roles'),
  ('Module', '/admin/module'),
  ('Revenue', '/admin/revenue'),
  ('Credit Note', '/admin/credit-note'),
  ('Configuration', '/admin/configuration'),
  ('Activity Log', '/admin/activity-log'),
  ('Notifications', '/admin/notifications'),
  ('Email', '/admin/email')
), inserted AS (
  INSERT INTO "Module" ("id", "name", "description", "route", "status", "createdAt", "updatedAt")
  SELECT gen_random_uuid(),
    CASE WHEN EXISTS (SELECT 1 FROM "Module" m WHERE m."name" = required."name")
      THEN required."name" || ' (' || gen_random_uuid()::text || ')'
      ELSE required."name" END,
    required."name", required."route", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM required
  WHERE NOT EXISTS (SELECT 1 FROM "Module" m WHERE m."route" = required."route")
  RETURNING "id"
)
INSERT INTO "RoleModule" ("id", "roleId", "moduleId", "canView", "canCreate", "canEdit", "canDelete")
SELECT gen_random_uuid(), role."id", inserted."id", true, true, true, true
FROM "Role" role CROSS JOIN inserted
WHERE role."isSystem" = true;
