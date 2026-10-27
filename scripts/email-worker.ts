import "@/lib/load-env"

import { startEmailProcessingLoop } from "@/lib/email/loop"

process.env.EMAIL_WORKER_PROCESS = "1"
startEmailProcessingLoop({ keepAlive: true })
