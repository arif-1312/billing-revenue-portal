import { randomBytes } from "node:crypto"

import { normalizeEmailList } from "./address"
import { singleLine } from "./html"

export type OutboundMail = {
  fromName: string
  fromAddress: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  text: string
  html: string
}

export function prepareOutboundMail(input: OutboundMail) {
  const to = normalizeEmailList(input.to)
  const cc = normalizeEmailList(input.cc ?? []).filter((email) => !to.includes(email))
  const bcc = normalizeEmailList(input.bcc ?? []).filter(
    (email) => !to.includes(email) && !cc.includes(email),
  )

  if (to.length === 0) {
    throw new Error("Invalid recipient address")
  }

  return {
    fromName: singleLine(input.fromName).slice(0, 120) || "Billing & Revenue Portal",
    fromAddress: input.fromAddress,
    to,
    cc,
    bcc,
    subject: encodeHeaderWord(singleLine(input.subject).slice(0, 180) || "Billing Portal notification"),
    text: input.text,
    html: input.html,
    recipients: [...to, ...cc, ...bcc],
  }
}

export function buildMimeMessage(input: OutboundMail) {
  const mail = prepareOutboundMail(input)
  const boundary = `billing-${randomBytes(12).toString("hex")}`
  const headers = [
    `From: ${formatFrom(mail.fromName, mail.fromAddress)}`,
    `To: ${mail.to.join(", ")}`,
    mail.cc.length ? `Cc: ${mail.cc.join(", ")}` : "",
    `Subject: ${mail.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean)

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(mail.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(mail.html),
    `--${boundary}--`,
    "",
  ]

  return {
    recipients: mail.recipients,
    message: [...headers, "", ...body].join("\r\n"),
  }
}

export function escapeSmtpData(data: string) {
  return data.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..")
}

function formatFrom(name: string, email: string) {
  if (/^[\x20-\x7E]*$/.test(name)) {
    return `"${name.replace(/"/g, "")}" <${email}>`
  }
  return `${encodeHeaderWord(name)} <${email}>`
}

function encodeHeaderWord(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

function wrapBase64(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trim()
}
