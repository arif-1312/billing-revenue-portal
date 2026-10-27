# Billing Portal remediation tracker

Audit source: architecture review on 26 October 2026. Finding IDs follow that review in order. Financial-integrity edits from the earlier remediation are still uncommitted in this working tree and were not reverted.

Statuses mean the code now in the working tree. A finding is Fixed only when the change is implemented and covered by a passing test or a direct code check.

| Finding ID | Category | Severity | Original Issue | Fix Implemented | Files Changed | Tests | Status |
|---|---|---|---|---|---|---|---|
| H-01 | Financial integrity | High | Import and delete bypassed closed-order and paid-cycle rules, and import replaced payment history | Shared guards run inside the locked transaction. Import keeps existing receipts. | `lib/purchase-order-guard.ts`, `lib/financial-write.ts`, `lib/actions/purschase-order.ts`, `lib/revenue-import-save.ts`, `lib/actions/revenue-excel.ts` | `lib/financial-integrity.test.ts` in the full Vitest run | Fixed |
| H-02 | Financial integrity | High | Audit rows were written after the money transaction committed | Audit insert is flushed on the same transaction client. A failed insert rolls the money change back. | `lib/audit.ts`, `lib/prisma.ts` | `lib/financial-integrity.test.ts` | Fixed |
| H-03 | Financial integrity | High | Dashboard totals and payment rows could disagree, and a paid flag with no cash counted as collected | Payment rows are the collection source when they exist. The paid flag does not invent cash. | `lib/invoice-balances.ts`, `lib/actions/dashboard.ts`, `lib/actions/revenue.ts` | `lib/invoice-balances.test.ts` | Fixed |
| H-04 | Database | High | Invoice numbers were not unique, and purchase-order splits dropped remainder paise | Splits use decimal remainder allocation. Duplicate non-blank numbers are rejected in the transaction. Existing duplicates can still be saved. The unique index was not applied. | `lib/money.ts`, `lib/financial-write.ts`, `lib/actions/purschase-order.ts` | `lib/financial-integrity.test.ts`; read-only duplicate query on the development database | Partially Fixed |
| H-05 | Performance | High | Dashboard and reports load billing cycles into Node. Notifications reload every purchase order | Not rewritten. A SQL port could change the totals that H-03 just aligned. No load test was run. | None in this pass | Not run | Not Started |
| H-06 | Performance | High | Admin layout loaded the permission graph four times per module. Session validation queried the database on every auth read | The layout uses the user already loaded. Repeated permission and session reads in one Next.js request share React's request cache. One session read per request remains, because disablement and logout must still be checked. | `lib/rbac.ts`, `lib/request-cache.ts`, `app/(protected)/admin/layout.tsx`, `lib/session-revocation.ts` | `lib/rbac.test.ts` confirms one user query for all four actions | Fixed |
| H-07 | Database | High | Foreign keys used by revenue joins are not indexed | Index SQL is proposed below. No migration was created or applied. | None | Not run | Requires Approval |
| H-08 | Production readiness | High | No CI, health check, backups, or shared rate limit. Branding files are local. No MFA or password reset. Auth.js is a beta | Health check and production action rate limits were added. MFA, CI, backups, object storage, and leaving the Auth.js beta were not. | `app/api/health/route.ts`, `lib/action-rate-limit.ts`, `lib/login-rate-limit.ts` | Full Vitest run. Health route was not called against a live server. | Partially Fixed |
| M-01 | Financial integrity | Medium | Closed-order and updatedAt checks ran before the transaction, and updatedAt is optional | The check now runs after the row lock. Omitting updatedAt still skips the version comparison. | `lib/actions/purschase-order.ts`, `lib/purchase-order-guard.ts` | `lib/financial-integrity.test.ts`, `lib/security-remediation.test.ts` | Partially Fixed |
| M-02 | Authentication | Medium | A failed logout lookup left the session valid. A token with no lastActive never idled out | A logout-lookup error fails the session. A missing lastActive value is treated as idle. | `lib/session-revocation.ts`, `lib/session-decision.ts`, `auth.ts` | `lib/session-revocation.failclosed.test.ts`, `lib/security-remediation.test.ts` | Fixed |
| M-03 | API security | Medium | Login trusted the first X-Forwarded-For hop. Excel limits lived in process memory | IP limits apply only when `TRUST_PROXY=true`, using the last hop. In production, Excel and export limits use `RateLimitBucket`. | `lib/client-address.ts`, `auth.ts`, `lib/login-rate-limit.ts`, `lib/action-rate-limit.ts`, `lib/actions/revenue-excel.ts`, `.env.example` | `lib/request-hardening.test.ts`, `lib/security-remediation.test.ts`, `lib/request-security.test.ts` | Fixed |
| M-04 | Security | Medium | Production CSP allows unsafe-inline scripts. HTTP is not redirected by the app | Production requests that a proxy marks as `http` redirect to HTTPS, except localhost. `unsafe-inline` remains because Next.js needs a nonce setup before it can be removed. | `lib/https-upgrade.ts`, `proxy.ts` | `lib/request-hardening.test.ts` | Partially Fixed |
| M-05 | Security | Medium | PAN, GST, phone, and email are stored in clear text. One revenue viewer sees the whole ledger | No code change. This is the documented single-organisation model. A second organisation needs a tenant id and filtered queries. | None | Not run | Not Applicable |
| M-06 | Reliability | Medium | Security and audit failures are only `console.error`. Expired rate-limit rows were never deleted | Expired `RateLimitBucket` rows are deleted on the production limiter, at most every five minutes. A log drain was not added. | `lib/login-rate-limit.ts` | Covered indirectly by the login limiter tests. Purge failure is swallowed so login still works. | Partially Fixed |
| M-07 | Database | Medium | Decimal scales differ, and several purchase-order fields are optional | No schema change. Altering money columns is a migration and can affect stored amounts. | None | Not run | Requires Approval |
| L-01 | Code quality | Low | Redux, TanStack Query, and server actions overlap. Forms logged validation results and server responses | Those `console.log` calls were removed. The state libraries and the `purschase-order.ts` filename were left in place. | Form components under `components/` | No dedicated test. Typecheck passed. | Partially Fixed |
| L-02 | Code quality | Low | User edit and P&L view pages started with `use server` | The directive was removed. The files remain server components. | `app/(protected)/admin/users/edit/[id]/page.tsx`, `app/(protected)/admin/pl/view/[id]/page.tsx` | Typecheck passed. Pages were not opened in a browser. | Fixed |
| L-03 | Authentication | Low | Auth.js used a Prisma adapter, but the schema has no Account or Session tables | The adapter was removed. Login stays on the credentials provider and JWT sessions. | `auth.ts` | `lib/credentials.test.ts`, `lib/auth-session.test.ts` | Fixed |
| L-04 | Security | Low | Mailbox encryption uses a fixed scrypt salt and can fall back to `AUTH_SECRET` | No code change. Changing the salt would make stored mailbox passwords unreadable. Set `CONFIG_ENCRYPTION_KEY` in production. | None | Existing mailbox test still passes | Not Applicable |

## Proposed indexes

Do not apply until approved. Each statement only adds an index. It does not rewrite financial rows. Expect a short lock while PostgreSQL builds the index. Extra indexes slow inserts and updates slightly and speed the listed joins.

```sql
CREATE INDEX IF NOT EXISTS "BillingCycle_purchaseOrderId_idx"
  ON "BillingCycle" ("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "BillingCycle_invoiceDate_idx"
  ON "BillingCycle" ("invoiceDate");
CREATE INDEX IF NOT EXISTS "BillingCycle_paymentDueDate_idx"
  ON "BillingCycle" ("paymentDueDate");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_customerId_idx"
  ON "PurchaseOrder" ("customerId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_companyId_idx"
  ON "PurchaseOrder" ("companyId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_vendorId_idx"
  ON "PurchaseOrder" ("vendorId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_billingPlanId_idx"
  ON "PurchaseOrder" ("billingPlanId");
CREATE INDEX IF NOT EXISTS "User_roleId_idx"
  ON "User" ("roleId");
CREATE INDEX IF NOT EXISTS "Project_companyId_idx"
  ON "Project" ("companyId");
CREATE INDEX IF NOT EXISTS "ProjectMonthlyPL_projectId_idx"
  ON "ProjectMonthlyPL" ("projectId");
```

`BillingCycle.purchaseOrderId` supports every invoice list and dashboard join. The date indexes support financial-year filters once those queries push the range into SQL. Party indexes support purchase-order filters. `User.roleId` supports the permission load. Project indexes support P&L.

The invoice-number unique index is separate and must wait until the 15 duplicate pairs in the development database are reviewed. Neon was not scanned.

## Proposed CI workflow

Not added. Approval is required before a workflow file is committed. The pipeline should install dependencies, run `tsc --noEmit`, ESLint, and `vitest run`, then `npm run build` with CI secrets that are not the developer Neon URL. It should not deploy.

## Verification in this pass

- `npx tsc --noEmit` passed after the final auth typing change.
- ESLint on the security files passed after the `any` callbacks in `auth.ts` were removed. `types/next-auth.d.ts` still warns that the `NextAuth` import is unused. That import was already there for module augmentation and is not an error.
- `npx vitest run`: 25 files, 130 tests, passed.
- Production build was not run. On this machine it loads the production environment.
- No query timings or load tests were captured. Performance claims above are from the code path, not from measured latency.
- The health route was not requested in a browser.

## Still needing a decision

- Apply the foreign-key indexes.
- Review duplicate invoice numbers, then add the partial unique index.
- Add the CI workflow.
- Choose shared file storage before running more than one app instance. Branding files remain in `public/uploads`.
- Add MFA and password reset as product work.
- Move dashboard totals into SQL only with a fixture that proves the numbers match the current functions.
