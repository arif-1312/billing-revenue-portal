# Security model

This portal is a single-organization ledger. A user who can view revenue can see every customer, company, and invoice in that ledger. There is no tenant or per-customer ownership check. Supporting multiple organizations would require a tenant id on users and on financial records, and every query would have to filter by that tenant.

## Environment

`APP_ENV` must be `development`, `test`, or `production`. The application refuses to start when it is missing or any other value.

Production database connections that are not on localhost use TLS and verify the server certificate. Local development does not require TLS. Keep `DATABASE_URL` out of source control.

The initial administrator is created only by `prisma db seed`. `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_EMAIL` are required. Production rejects a password shorter than 12 characters and the known development password. Do not leave seed credentials in a production environment file after the first administrator exists.

## Secrets

The mailbox password stored on the configuration record is encrypted with AES-256-GCM before it is stored. The key is `CONFIG_ENCRYPTION_KEY`, or `AUTH_SECRET` when that dedicated key is unset. Production should set `CONFIG_ENCRYPTION_KEY` and keep it outside the database and the repository. That stored mailbox password is not used to send mail.

Outbound email uses SMTP settings from the server environment: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, and `SMTP_FROM_NAME`. The admin email page shows the host, port, security mode, and a masked sender address. It never receives the password. Test messages can be sent only to the signed-in administrator's own account address.

The settings screen receives only `passwordConfigured`. It never receives the password. Saving a blank password keeps the stored value. Saving a new password replaces it. A password stored before this change remains readable only on the server until an administrator saves a new one; that save encrypts the replacement. Rotate the mailbox password after deploying this change.

## Sessions and passwords

Sessions are JWT cookies, HttpOnly, `SameSite=Lax`, and `Secure` in production. The absolute lifetime is 12 hours. An idle session expires after 2 hours. Password changes and deactivated users invalidate the session on the next request because the token fingerprint or account status no longer matches.

Logout is the POST server action `logoutUser`. It records a logout event and invalidates tokens issued before that event. `GET /api/session/end` does not log out a valid session. It only clears a cookie after the session is already invalid.

Passwords are hashed with bcrypt at cost 12. New passwords and password changes need at least 12 characters and three of: lowercase, uppercase, number, symbol, and they reject a short list of common passwords. A forgotten password can be reset from the login page. The reset link is single-use, expires after 15 minutes, and only a hash of the token is stored. Changing the password invalidates existing sessions because the session fingerprint no longer matches. There is no multi-factor authentication.

Login failures are limited to five attempts per account and per source address in a 15-minute window. Production stores those counters in `RateLimitBucket` so they survive another application instance. The limit expires; it does not permanently lock the account. Unknown usernames and wrong passwords return the same result, and a dummy bcrypt comparison runs when the account does not exist.

## Roles

Permissions come from `RoleModule` for an active user, an active role, and an active module. The role name does not grant access. The seeded `Admin` role is marked `isSystem`. Only a system administrator can change that role, and it cannot be renamed, disabled, or deleted. A user cannot grant a permission they do not already have, and cannot assign the system role unless they are a system administrator. The last active system administrator cannot be deleted, deactivated, or moved to another role.

## Financial audit

Purchase orders, billing cycles, payments, and vendors are critical audit models. If writing their audit record fails, the business change fails with it when the write goes through Prisma. Payment rows are included in the billing-cycle audit snapshot. Closed purchase orders can be changed only by a system administrator. Ordinary edits update cycles in place and will not drop paid history without delete permission.

Money columns use `DECIMAL(14,2)`. Invoice outstanding math uses decimal arithmetic and rounds to paise.

## Backups and response

Database backups, retention, and restore tests are an operations responsibility and are not implemented in this repository. Keep backups encrypted and test a restore. After a suspected account compromise, deactivate the user, rotate `AUTH_SECRET` and `CONFIG_ENCRYPTION_KEY`, and rotate the mailbox password.
