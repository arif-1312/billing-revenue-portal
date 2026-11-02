# Billing & Revenue Portal

Next.js and Prisma application with one codebase and two separated environments.

| | Development | Production |
|---|---|---|
| Where it runs | This machine, `npm run dev` | The production host |
| Config file | `.env.local` (gitignored) | Host environment variables |
| Database | Local PostgreSQL, database `billing_revenue_dev` | Existing Neon database |
| `APP_ENV` | `development` | `production` |

`.env` still holds the live Neon credentials. It is gitignored and is not the development database. Do not point `.env.local` at Neon.

## Development environment

Local PostgreSQL 16 on `localhost:5432`, database `billing_revenue_dev`.

1. Copy the template and fill in local values:

```bash
copy .env.example .env.local
```

2. Set `APP_ENV=development`.
3. Set `DATABASE_URL` to local PostgreSQL. The database name is `billing_revenue_dev`.
4. Set a development-only `AUTH_SECRET`.
5. Set `AUTH_URL` and `NEXT_PUBLIC_SERVER_URL` to `http://localhost:3000`.

Start the app:

```bash
npm run dev
```

For access from another device on the same network, set `AUTH_URL`,
`NEXT_PUBLIC_SERVER_URL`, and `NEXT_APP_SERVER_URL` in `.env.local` to the address
that device opens, for example `http://192.168.1.31:3000`. Restart `npm run dev`
after changing these values. Auth.js uses `AUTH_URL` for login redirects, so a
`localhost` value sends the client back to its own computer.
The development server also allows that configured hostname to load Next.js
development resources through `allowedDevOrigins` in `next.config.ts`.

The development database is empty until the existing migrations are applied. That command is not run automatically. Approve it before running:

```bash
npx prisma migrate deploy
```

That applies the migrations already in `prisma/migrations` to whichever database `DATABASE_URL` resolves to. With `.env.local` present, that is `billing_revenue_dev`.

## Production environment

Production does not read `.env.local`. Set these on the host:

- `APP_ENV=production`
- `DATABASE_URL` — the Neon connection string currently in `.env`
- `AUTH_SECRET` — a different secret from development
- `AUTH_URL` — the public production URL
- `NEXT_PUBLIC_SERVER_URL` — the same public URL
- `NEXT_APP_APP_NAME`
- `NEXT_APP_DESCRIPTION`
- `NEXT_APP_SERVER_URL`

`npm run dev` loads `.env.local` and uses local PostgreSQL. `npm run build` and `npm run start` load `.env.production.local` first, so they use the Neon database. Run the production instance on another port when both are open:

```bash
npm run dev
npx next start -p 3001
```

## Environment variables

| Variable | Development | Production |
|---|---|---|
| `APP_ENV` | `development` | `production` |
| `DATABASE_URL` | `localhost` / `billing_revenue_dev` | Neon |
| `AUTH_SECRET` | Unique to development | Unique to production |
| `AUTH_URL` | `http://localhost:3000` | Public production URL |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:3000` | Public production URL |
| `NEXT_APP_SERVER_URL` | `http://localhost:3000` | Public production URL |
| `NEXT_APP_APP_NAME` | Display name | Display name |
| `NEXT_APP_DESCRIPTION` | Description | Description |

`DATABASE_URL` and `AUTH_SECRET` are server-only. Do not prefix them with `NEXT_PUBLIC_`.

## `.env.example`

`.env.example` is the only environment file that belongs in Git. It lists variable names and placeholders. Real passwords, database URLs, and auth secrets belong in `.env.local` or on the production host.

## Local development setup

- PostgreSQL 16 listening on port 5432
- Database `billing_revenue_dev`
- `.env.local` filled from `.env.example`
- `npm install`
- `npm run dev`

## Production build

```bash
npm run build
```

On this machine the build loads `.env.production.local` and uses the Neon database. On the production host, set the host variables before building so `NEXT_PUBLIC_*` values are baked into the client bundle. Host variables override the local files.

## Production start

```bash
npm run start
```

The host must set `APP_ENV=production` and the Neon `DATABASE_URL`. The app refuses a production `APP_ENV` that points at `localhost`.

## Database separation

```
Development (npm run dev)
        DATABASE_URL in .env.local
        localhost:5432 / billing_revenue_dev

Production (host)
        DATABASE_URL on the host
        Neon / neondb
```

Development refuses a Neon URL. Production refuses a localhost URL when `APP_ENV=production`.

## Prisma commands

Prisma CLI uses the same file order as Next.js. With `NODE_ENV` unset, commands use `.env.local` and the local development database. `NODE_ENV=production` uses `.env.production.local` and Neon. A `DATABASE_URL` already set by the host is never overwritten.

Safe against the local development database, after you approve them:

```bash
npx prisma validate
npx prisma migrate deploy
npx prisma generate
```

Do not run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against the Neon database. `prisma db seed` creates the admin login for the current instance. Development uses `admin` / `admin123` unless `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_EMAIL` are set. Production requires those three variables on the host and refuses the development password.

## Login protection

Five failed logins within the 15-minute counting window block login for 30 minutes
starting at the fifth failure. The login form shows the attempts remaining and,
while blocked, how many minutes remain. Blocked requests do not extend the lock.
A successful login clears the failure count. Account status is not changed.

Only one browser/device session can be active per user. Other devices must wait
until the owner signs out or the session expires. Tabs in the same browser share
the session. The existing two-hour idle timeout and twelve-hour maximum lifetime
apply. PostgreSQL enforces ownership across application instances, and password
changes invalidate the previous session.

Apply migration `20261030120000_single_active_login` before running this version.
For production, run `npx prisma migrate deploy` on the production host with
`NODE_ENV=production` and the production environment variables configured.
Sessions created before this change must sign in again.

The PostgreSQL regression tests use disposable local fixture users and clean
them up. To run them in PowerShell after applying the local migration:

```powershell
$env:RUN_AUTH_DATABASE_TESTS = '1'
npx vitest run lib/auth-database.integration.test.ts
```

## Git workflow

- `develop` deploys the development environment
- `main` deploys production

Those branches are not created by this setup. Commit `.env.example`. Do not commit `.env` or `.env.local`.

## Deployment configuration

No hosting platform is connected yet. When you deploy, create two separate targets:

Development deployment:

- Branch `develop`
- `APP_ENV=development` only if that target has its own Postgres instance
- Its own `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`
- This local machine uses localhost Postgres instead of a hosted development app

Production deployment:

- Branch `main`
- `APP_ENV=production`
- Neon `DATABASE_URL`
- A different `AUTH_SECRET` and the public `AUTH_URL`

Do not reuse the development database URL on the production host.

## Security precautions

- `.env` and `.env.local` stay gitignored
- `.env.example` contains placeholders only
- Development and production use different `AUTH_SECRET` values
- Do not copy the Neon URL into `.env.local`
- Run `prisma db seed` against production only with `APP_ENV=production` and a unique `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_EMAIL`
- Email sender passwords stored in the `Configuration` table stay in that database and are not environment variables
