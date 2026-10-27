import { escapeHtml, plainText, singleLine } from "./html"

export function renderPasswordResetEmail(input: {
  portalName: string
  recipientName: string
  resetUrl: string
}) {
  const portalName = singleLine(input.portalName) || "Billing & Revenue Portal"
  const recipientName = singleLine(input.recipientName) || "there"
  const resetUrl = input.resetUrl

  const text = [
    `Hello ${recipientName},`,
    "",
    "We received a request to reset your Billing & Revenue Portal password.",
    "",
    "Open this link to create a new password:",
    resetUrl,
    "",
    "This link will expire in 15 minutes and can only be used once.",
    "",
    "If you did not request this password reset, you can ignore this email.",
    "",
    "Regards,",
    `${portalName} Team`,
  ].join("\n")

  const html = authHtml({
    portalName,
    heading: "Reset your password",
    recipientName,
    paragraphs: [
      "We received a request to reset your Billing & Revenue Portal password.",
      "This link will expire in 15 minutes and can only be used once.",
      "If you did not request this password reset, you can ignore this email.",
    ],
    actionUrl: resetUrl,
    actionLabel: "Reset Password",
  })

  return { text, html }
}

export function renderPasswordChangedEmail(input: {
  portalName: string
  recipientName: string
  when: string
}) {
  const portalName = singleLine(input.portalName) || "Billing & Revenue Portal"
  const recipientName = singleLine(input.recipientName) || "there"
  const when = singleLine(input.when)

  const text = [
    `Hello ${recipientName},`,
    "",
    "Your Billing & Revenue Portal account password has been changed successfully.",
    "",
    `Date: ${when}`,
    "",
    "If you did not make this change, please contact your system administrator immediately.",
    "",
    "Regards,",
    `${portalName} Team`,
  ].join("\n")

  const html = authHtml({
    portalName,
    heading: "Your password has been changed",
    recipientName,
    paragraphs: [
      "Your Billing & Revenue Portal account password has been changed successfully.",
      `Date: ${when}`,
      "If you did not make this change, please contact your system administrator immediately.",
    ],
  })

  return { text, html }
}

function authHtml(input: {
  portalName: string
  heading: string
  recipientName: string
  paragraphs: string[]
  actionUrl?: string
  actionLabel?: string
}) {
  const paragraphs = input.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(plainText(paragraph))}</p>`)
    .join("")
  const button = input.actionUrl
    ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">${escapeHtml(input.actionLabel || "Open")}</a></p>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#1d4ed8;">${escapeHtml(input.portalName.toUpperCase())}</p>
              <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(input.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-family:Arial,sans-serif;color:#334155;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Hello ${escapeHtml(input.recipientName)},</p>
              ${paragraphs}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#64748b;">
              Regards,<br>${escapeHtml(input.portalName)} Team
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
