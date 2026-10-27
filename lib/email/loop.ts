import { processEmailBatch } from "./deliver"

const globalState = globalThis as typeof globalThis & {
  emailProcessingLoop?: boolean
}

export function startEmailProcessingLoop(options?: { keepAlive?: boolean }) {
  if (globalState.emailProcessingLoop) return
  globalState.emailProcessingLoop = true

  const intervalMs = Math.min(
    Math.max(Number(process.env.EMAIL_WORKER_INTERVAL_MS || 15_000), 5_000),
    300_000,
  )

  const run = () => {
    void processEmailBatch({ limit: 20 })
      .then((result) => {
        if (result.processed > 0) {
          console.log(
            `Email delivery processed ${result.processed} (sent ${result.sent}, retrying ${result.retrying}, failed ${result.failed}, deferred ${result.deferred})`,
          )
        }
      })
      .catch(() => {
        console.error("Email delivery batch failed")
      })
  }

  run()
  const timer = setInterval(run, intervalMs)
  if (!options?.keepAlive) timer.unref()
}
