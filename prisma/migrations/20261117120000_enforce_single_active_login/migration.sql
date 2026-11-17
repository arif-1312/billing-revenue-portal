-- Keep the most recently active valid device session before restoring the
-- one-row-per-user constraint.
WITH ranked_logins AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY
        (
          "expiresAt" > CURRENT_TIMESTAMP
          AND "lastActiveAt" > CURRENT_TIMESTAMP - INTERVAL '2 hours'
        ) DESC,
        "lastActiveAt" DESC,
        "createdAt" DESC,
        "sessionHash" DESC
    ) AS position
  FROM "ActiveLogin"
)
DELETE FROM "ActiveLogin" AS active_login
USING ranked_logins
WHERE active_login.ctid = ranked_logins.ctid
  AND ranked_logins.position > 1;

ALTER TABLE "ActiveLogin"
DROP CONSTRAINT "ActiveLogin_pkey";

ALTER TABLE "ActiveLogin"
ADD CONSTRAINT "ActiveLogin_pkey" PRIMARY KEY ("userId");
