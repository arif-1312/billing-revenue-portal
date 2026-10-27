import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { renderPasswordChangedEmail, renderPasswordResetEmail } from "@/lib/email/auth-mail"

const reset = renderPasswordResetEmail({
  portalName: "SY Associates",
  recipientName: "Asha Rao",
  resetUrl: "http://localhost:3000/reset-password?token=sample-token",
  brand: { supportEmail: "billing@thesyassociates.com" },
})

const changed = renderPasswordChangedEmail({
  portalName: "SY Associates",
  recipientName: "Asha Rao",
  username: "asha",
  when: "27 Oct 2026, 12:00 pm IST",
  activityDate: "27 Oct 2026",
  activityTime: "12:00 pm IST",
  brand: { supportEmail: "billing@thesyassociates.com" },
})

const directory = resolve(process.cwd(), "tmp", "email-previews")
mkdirSync(directory, { recursive: true })
writeFileSync(resolve(directory, "password-reset.html"), reset.html)
writeFileSync(resolve(directory, "password-updated.html"), changed.html)
console.log(`Email previews written to ${directory}`)
