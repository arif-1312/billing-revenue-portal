# Application audit — work in progress

Date: 2026-11-18. This is a partial audit and a continuation point, not a certification that every route or workflow was inspected or tested.

## Inventory

There are 55 page/route files and 21 directories under `app/(protected)/admin` (one, `revenue-dashboard`, is empty). Active areas: activity log, billing plans, companies, configuration, contract durations and types, credit notes, customers, dashboard, email, home, modules, notifications, P&L/projects, profile, revenue/purchase orders, roles, service types, users and vendors. Guest pages cover login and password recovery; API routes cover Auth.js, health and session end. There is no distinct price-list model or route in the inspected schema/routes; do not assume one exists.

The Prisma schema contains 27 models, including financial billing cycles and payments, purchase orders, parties, users/RBAC, credit notes, notifications, email jobs, audit logs and session/rate-limit records. CRUD and reporting use server actions in `lib/actions`, with Prisma/PostgreSQL and shared validation, money, financial-integrity and RBAC helpers. This is a structural inventory, not proof that every action has been reviewed.

## Coverage matrix

| Area | Evidence obtained | Still needed |
| --- | --- | --- |
| Authentication, sessions, RBAC | Credential, session, RBAC, password-reset and request-security unit tests; reviewed JWT and session-revocation paths | Browser flows, concurrent logins, real isolated database and logout-token revocation design |
| Dashboard, credit notes, receivables | Dashboard credit-note, billing overview, metrics, invoice balance and fiscal-year unit tests | Browser charts/filter/refresh checks; independent reconciliation and credit-note ownership |
| Purchase orders and billing | Purchase-order creation and financial-integrity unit tests; inspected transaction references | Full CRUD, concurrency, transaction rollback, status and payment workflow with isolated synthetic data |
| Notifications | Model, channels and outstanding tests; three failures remain | Resolve staged expiry behavior, deduplication, RBAC and browser interaction |
| Email | Email, authentication mail and boundary unit tests | Isolated queue/retry integration; no live emails sent |
| Users, customers, configuration, audit | Focused permission tests | CRUD, validation, IDOR and browser tests |
| Companies, vendors, billing plans, service and contract configuration, roles, modules, projects/P&L, reports, profile, home | Route/model inventory; profile build behavior | Module-by-module functional, security, accessibility and responsive testing |
| Exports | Credit-note spreadsheet and revenue spreadsheet security tests | Download and large-data browser tests |

## Security and performance observations

- Next.js build reports a known vulnerability and recommends an upgrade. `npm audit --omit=dev` separately returned zero advisories; do not interpret that as disproving the build warning.
- With the user's prior request to allow concurrent sign-ins, a copied JWT is not individually revoked server-side at logout. Password changes and disabled accounts still invalidate sessions. Remediation needs a per-session revocation design compatible with multiple devices.
- The credit-note register lacks invoice/company/status relationships. Company/status figures are inferred through customer purchase orders, and cannot establish applied credits.
- Dashboard actions perform repeated billing-cycle and credit-note reads. Query plans and scalability have not been measured against representative data.
- The production build printed PostgreSQL SSL-mode compatibility warnings; verify the deployed driver's certificate configuration before changing it.

## Boundaries

No migrations, database mutations, production record tests, browser/E2E workflows or live email were executed. Seven opt-in auth database tests were skipped; they are designed around the previous single-session rule and are not evidence of current concurrent-session behavior. No isolated test database or E2E runner was established. Schema validation is not a database migration or data-integrity check. Continue with the prioritized items in REMAINING_ISSUES.md.
