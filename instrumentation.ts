export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === "phase-production-build") return

  const { startEmailProcessingLoop } = await import("@/lib/email/loop")
  startEmailProcessingLoop()
}
