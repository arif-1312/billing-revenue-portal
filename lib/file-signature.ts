const PNG = [0x89, 0x50, 0x4e, 0x47]
const JPEG = [0xff, 0xd8, 0xff]
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP_WEBP = [0x57, 0x45, 0x42, 0x50]
const ICO = [0x00, 0x00, 0x01, 0x00]

function startsWith(buffer: Buffer, bytes: number[], offset = 0) {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

export function fileMatchesSignature(buffer: Buffer, extension: string) {
  if (buffer.length < 8) return false

  if (extension === ".png") return startsWith(buffer, PNG)
  if (extension === ".jpg" || extension === ".jpeg") return startsWith(buffer, JPEG)
  if (extension === ".webp") {
    return startsWith(buffer, WEBP_RIFF) && startsWith(buffer, WEBP_WEBP, 8)
  }
  if (extension === ".ico") return startsWith(buffer, ICO)

  return false
}
