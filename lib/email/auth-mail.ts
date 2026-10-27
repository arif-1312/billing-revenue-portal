import { RESET_TOKEN_TTL_MS } from "@/lib/password-reset"

import {
  EMAIL_PRODUCT_NAME,
  emailButton,
  emailDocument,
  emailInfoTable,
  emailParagraphs,
  emailSecurityNotice,
  type EmailBrand,
} from "./layout"
import { singleLine } from "./html"

export function resetLinkLifetimeLabel() {
  const minutes = Math.round(RESET_TOKEN_TTL_MS / 60_000)
  return minutes === 1 ? "1 minute" : `${minutes} minutes`
}

export function renderPasswordResetEmail(input: {
  portalName: string
  recipientName: string
  resetUrl: string
  brand?: EmailBrand
}) {
  const recipientName = singleLine(input.recipientName) || "there"
  const lifetime = resetLinkLifetimeLabel()
  const brand = {
    portalName: EMAIL_PRODUCT_NAME,
    companyName: input.portalName,
    ...input.brand,
  }

  const text = [
    `Hello ${recipientName},`,
    "",
    "We received a request to reset the password associated with your Billing & Revenue Portal account.",
    "",
    "To securely reset your password, open this link:",
    input.resetUrl,
    "",
    `For security purposes, this link will expire in ${lifetime} and can only be used once.`,
    "",
    "If you did not request this password reset, you may safely ignore this email. Your existing password will remain unchanged.",
    "",
    "Security notice: Never share your password or password reset link with anyone.",
    "",
    "Regards,",
    "Billing & Revenue Portal Team",
  ].join("\n")

  const html = emailDocument({
    preheader: `Reset your password. This link expires in ${lifetime}.`,
    brand,
    heading: "Password reset request",
    introHtml: emailParagraphs([
      `Hello ${recipientName},`,
      "We received a request to reset the password associated with your Billing & Revenue Portal account.",
      "To securely reset your password, please click the button below.",
    ]),
    bodyHtml: [
      emailButton(input.resetUrl, "Reset Password"),
      emailParagraphs([
        `For security purposes, this link will expire in ${lifetime} and can only be used once.`,
        "If you did not request this password reset, you may safely ignore this email. Your existing password will remain unchanged.",
      ]),
      emailSecurityNotice("Never share your password or password reset link with anyone."),
    ].join(""),
  })

  return { text, html }
}

export function renderPasswordChangedEmail(input: {
  portalName: string
  recipientName: string
  when: string
  username?: string | null
  activityDate?: string | null
  activityTime?: string | null
  brand?: EmailBrand
}) {
  const recipientName = singleLine(input.recipientName) || "there"
  const username = singleLine(input.username || "") || "your account"
  const activityDate = singleLine(input.activityDate || "") || input.when
  const activityTime = singleLine(input.activityTime || "")
  const brand = {
    portalName: EMAIL_PRODUCT_NAME,
    companyName: input.portalName,
    ...input.brand,
  }

  const text = [
    `Hello ${recipientName},`,
    "",
    "This is to confirm that the password associated with your Billing & Revenue Portal account has been successfully updated.",
    "",
    "Account activity details",
    `Username: ${username}`,
    "Activity: Password Updated",
    `Date: ${activityDate}`,
    activityTime ? `Time: ${activityTime}` : "",
    "",
    "If you initiated this change, no further action is required.",
    "",
    "If you did not authorize this activity, please contact your system administrator immediately.",
    "",
    "Regards,",
    "Billing & Revenue Portal Team",
  ]
    .filter((line) => line !== "")
    .join("\n")

  const html = emailDocument({
    preheader: "Your Billing & Revenue Portal password was updated.",
    brand,
    heading: "Password updated successfully",
    accent: "success",
    introHtml: emailParagraphs([
      `Hello ${recipientName},`,
      "This is to confirm that the password associated with your Billing & Revenue Portal account has been successfully updated.",
    ]),
    bodyHtml: [
      `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;color:#047857;">ACCOUNT ACTIVITY DETAILS</p>`,
      emailInfoTable([
        { label: "Username", value: username },
        { label: "Activity", value: "Password Updated" },
        { label: "Date", value: activityDate },
        { label: "Time", value: activityTime },
      ]),
      emailParagraphs([
        "If you initiated this change, no further action is required.",
        "If you did not authorize this activity, please contact your system administrator immediately.",
      ]),
      emailSecurityNotice("If you did not authorize this activity, contact your system administrator immediately."),
    ].join(""),
  })

  return { text, html }
}
