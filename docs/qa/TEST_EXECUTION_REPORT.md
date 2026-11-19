# Test execution report

Date: 2026-11-18. Windows/PowerShell workspace; installed dependencies; no isolated database or E2E runner. Existing uncommitted changes were present before this audit.

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed after fixes. |
| `npm run lint` | Failed: 125 errors and 62 warnings across the repository. |
| `npx eslint 'app/(protected)/admin/profile/page.tsx' lib/auth-session.test.ts lib/auth-single-session.test.ts` | Passed. |
| `npm test` | After fixes: 244 passed, 3 failed, 7 skipped, 254 total. The failures are the notification expectations in QA-005. Ran outside the sandbox because Vitest/esbuild could not spawn inside it. |
| `npm run build` | Initial build exited 1 after a Next.js security warning; profile prerender error also logged. Retry after fix exited 0, generated routes and logged the same Next.js vulnerability warning, without the profile error. |
| `npx prisma validate` | Passed after allowing the Prisma engine download. Validates the schema only. |
| `npm audit --omit=dev --json` | Completed: 0 reported production advisories. Does not supersede Next.js's own vulnerability warning; development dependencies were not audited. |
| `git diff --check` | No whitespace errors in the previous check; a line-ending warning was reported for an existing changed test. |

Database integration tests: 7 skipped by explicit opt-in guard. End-to-end, browser, real queue, concurrency and synthetic financial workflows: not run. No live email, migrations or database writes were performed as part of this audit.
