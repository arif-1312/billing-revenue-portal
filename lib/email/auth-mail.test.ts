import { describe, expect, it } from "vitest"

import { renderPasswordChangedEmail, renderPasswordResetEmail, resetLinkLifetimeLabel } from "./auth-mail"

const resetUrl = "http://localhost:3000/reset-password?token=sample-token-value"

describe("enterprise password emails", () => {
  it("renders the reset request with the secure link and expiry", () => {
    const message = renderPasswordResetEmail({
      portalName: "SY Associates",
      recipientName: "Asha <Rao>",
      resetUrl,
      brand: { supportEmail: "billing@thesyassociates.com", year: 2026 },
    })

    expect(message.html).toContain("Password reset request")
    expect(message.html).toContain("Hello Asha &lt;Rao&gt;")
    expect(message.html).toContain(`href="${resetUrl}"`)
    expect(message.html).toContain("Reset Password")
    expect(message.html).toContain(resetLinkLifetimeLabel())
    expect(message.html).toContain("SY Associates")
    expect(message.html).toContain("billing@thesyassociates.com")
    expect(message.html).toContain("Security notice")
    expect(message.html).not.toContain("<script>")
    expect(message.text).toContain(resetUrl)
  })

  it("renders the password update confirmation without a reset link", () => {
    const message = renderPasswordChangedEmail({
      portalName: "SY Associates",
      recipientName: "Asha Rao",
      username: "asha",
      when: "27 Oct 2026, 12:00 pm IST",
      activityDate: "27 Oct 2026",
      activityTime: "12:00 pm IST",
      brand: { year: 2026 },
    })

    expect(message.html).toContain("Password updated successfully")
    expect(message.html).toContain("asha")
    expect(message.html).toContain("Password Updated")
    expect(message.html).toContain("27 Oct 2026")
    expect(message.html).toContain("12:00 pm IST")
    expect(message.html).not.toContain("token=")
    expect(message.html).not.toContain("password=")
    expect(message.text).toContain("Username: asha")
  })

  it("ignores a logo that is not an http address", () => {
    const message = renderPasswordResetEmail({
      portalName: "SY Associates",
      recipientName: "Asha",
      resetUrl,
      brand: { logoUrl: "javascript:alert(1)", year: 2026 },
    })

    expect(message.html).not.toContain("javascript:")
    expect(message.html).not.toContain("<img")
  })
})
