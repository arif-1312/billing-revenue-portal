import net from "node:net"
import tls from "node:tls"

import type { SmtpConfig } from "./config"
import { buildMimeMessage, escapeSmtpData, type OutboundMail } from "./mime"

type SmtpSocket = net.Socket

export async function sendSmtpMail(config: SmtpConfig, input: OutboundMail) {
  const mime = buildMimeMessage({
    ...input,
    fromName: config.fromName,
    fromAddress: config.fromAddress,
  })
  let socket = await connect(config)

  try {
    await expectCode(socket, [220])
    await command(socket, `EHLO billing-portal`, [250])

    if (!config.secure) {
      await command(socket, "STARTTLS", [220])
      socket = await upgradeToTls(socket, config.host)
      armTimeout(socket)
      await command(socket, "EHLO billing-portal", [250])
    }

    await command(socket, "AUTH LOGIN", [334])
    await command(socket, Buffer.from(config.user).toString("base64"), [334])
    await command(socket, Buffer.from(config.password).toString("base64"), [235])
    await command(socket, `MAIL FROM:<${config.fromAddress}>`, [250])

    for (const recipient of mime.recipients) {
      await command(socket, `RCPT TO:<${recipient}>`, [250, 251])
    }

    await command(socket, "DATA", [354])
    socket.write(`${escapeSmtpData(mime.message)}\r\n.\r\n`)
    await expectCode(socket, [250])
    await command(socket, "QUIT", [221])
  } finally {
    socket.end()
  }
}

function connect(config: SmtpConfig) {
  return new Promise<SmtpSocket>((resolve, reject) => {
    const socket = config.secure
      ? tls.connect({
          port: config.port,
          host: config.host,
          servername: config.host,
        })
      : net.connect(config.port, config.host)

    socket.once(config.secure ? "secureConnect" : "connect", () => resolve(socket))
    socket.once("error", reject)
    armTimeout(socket)
  })
}

function upgradeToTls(socket: SmtpSocket, host: string) {
  return new Promise<SmtpSocket>((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      host,
      servername: host,
    })
    secureSocket.once("secureConnect", () => resolve(secureSocket))
    secureSocket.once("error", reject)
  })
}

function armTimeout(socket: SmtpSocket) {
  socket.setTimeout(20_000, () => {
    socket.destroy(new Error("SMTP connection timed out"))
  })
}

function readResponse(socket: SmtpSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = ""

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8")
      const lines = buffer.split(/\r?\n/).filter(Boolean)
      const lastLine = lines[lines.length - 1] ?? ""
      if (/^\d{3} /.test(lastLine)) {
        cleanup()
        resolve(buffer)
      }
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onClose = () => {
      cleanup()
      reject(new Error("SMTP connection closed"))
    }

    const cleanup = () => {
      socket.off("data", onData)
      socket.off("error", onError)
      socket.off("close", onClose)
    }

    socket.on("data", onData)
    socket.on("error", onError)
    socket.on("close", onClose)
  })
}

async function expectCode(socket: SmtpSocket, codes: number[]) {
  const response = await readResponse(socket)
  const code = Number(response.slice(0, 3))
  if (!codes.includes(code)) {
    throw new Error(`SMTP command failed: ${response.trim().slice(0, 300)}`)
  }
  return response
}

async function command(socket: SmtpSocket, line: string, codes: number[]) {
  socket.write(`${line}\r\n`)
  return expectCode(socket, codes)
}
