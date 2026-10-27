import { assertAppEnv } from "./environment"

const LOCAL_HOST = /@(localhost|127\.0\.0\.1)(?::\d+)?\//;

export function databasePoolOptions(connectionString: string) {
  const appEnv = assertAppEnv()
  const local = LOCAL_HOST.test(connectionString)

  return {
    connectionString,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ...(appEnv === "production" && !local
      ? { ssl: { rejectUnauthorized: true as const } }
      : {}),
  }
}

export function assertSafeDatabaseTarget(connectionString: string | undefined) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const appEnv = process.env.APP_ENV;
  const isNeon = /neon\.tech/i.test(connectionString);
  const isLocal = LOCAL_HOST.test(connectionString);

  if (appEnv === "development" && !isLocal) {
    throw new Error(
      "Development must use a local PostgreSQL DATABASE_URL on localhost.",
    );
  }

  if (appEnv === "production" && isLocal) {
    throw new Error(
      "Production must not use the local development database.",
    );
  }

  if (
    isNeon &&
    appEnv !== "production" &&
    process.env.NODE_ENV !== "production"
  ) {
    throw new Error(
      "Refusing to connect to the Neon database unless APP_ENV=production.",
    );
  }
}
