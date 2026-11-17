ALTER TABLE "ActiveLogin"
DROP CONSTRAINT "ActiveLogin_pkey";

ALTER TABLE "ActiveLogin"
ADD CONSTRAINT "ActiveLogin_pkey" PRIMARY KEY ("userId", "sessionHash");
