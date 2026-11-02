CREATE TABLE "ActiveLogin" (
    "userId" UUID NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "credentialVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActiveLogin_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "ActiveLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ActiveLogin_sessionHash_key" ON "ActiveLogin"("sessionHash");
CREATE INDEX "ActiveLogin_expiresAt_idx" ON "ActiveLogin"("expiresAt");
