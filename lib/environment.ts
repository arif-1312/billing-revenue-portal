const ALLOWED_APP_ENVS = new Set(["development", "test", "production"])

export function assertAppEnv(env: NodeJS.ProcessEnv = process.env) {
  const appEnv = env.APP_ENV?.trim()

  if (!appEnv || !ALLOWED_APP_ENVS.has(appEnv)) {
    throw new Error("APP_ENV must be development, test, or production.")
  }

  return appEnv as "development" | "test" | "production"
}

export function assertProductionSeedPassword(password: string | undefined, appEnv: string) {
  const value = password?.trim() ?? ""

  if (!value) {
    throw new Error("SEED_ADMIN_PASSWORD must be set before seeding.")
  }

  if (appEnv === "production" && (value.length < 12 || value === "admin123")) {
    throw new Error("Production seed cannot use a short or development password.")
  }

  return value
}
