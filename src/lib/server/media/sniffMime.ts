/**
 * Lightweight magic-byte sniffing for uploaded media.
 *
 * The client-declared `file.type` (MIME) is never trusted alone — a caller can
 * set an arbitrary Content-Type on a multipart upload. This checks the first
 * bytes of the actual file body against known signatures for the handful of
 * formats PostFlow accepts, so a mislabelled or malicious file is rejected
 * with a clear 400 instead of being stored and served back verbatim.
 *
 * No new dependency — this is a small, local, well-known signature table.
 */

export type SniffedMediaKind =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "mp4"
  | "quicktime"
  | "webm"

/** Declared MIME prefixes/values each sniffed kind is allowed to match. */
const KIND_TO_ALLOWED_MIME: Record<SniffedMediaKind, string[]> = {
  jpeg:      ["image/jpeg", "image/jpg"],
  png:       ["image/png"],
  gif:       ["image/gif"],
  webp:      ["image/webp"],
  // .mov files are very commonly declared as video/quicktime OR video/mp4 by
  // browsers/OSes, and share the same ISO base media (ftyp) container as mp4.
  mp4:       ["video/mp4", "video/quicktime"],
  quicktime: ["video/quicktime", "video/mp4"],
  webm:      ["video/webm"],
}

function bytesStartWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false
  }
  return true
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return ""
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

/**
 * Inspects the leading bytes of a file body and returns the detected media
 * kind, or null if it doesn't match any known signature.
 */
export function sniffMediaKind(bytes: Uint8Array): SniffedMediaKind | null {
  // JPEG: FF D8 FF
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg"

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png"

  // GIF: "GIF87a" or "GIF89a"
  if (bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif"

  // WebP: "RIFF"....."WEBP"
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") return "webp"

  // WebM (Matroska/EBML): 1A 45 DF A3
  if (bytesStartWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm"

  // ISO base media (MP4/QuickTime): bytes 4-8 spell "ftyp"
  if (asciiAt(bytes, 4, 4) === "ftyp") {
    const brand = asciiAt(bytes, 8, 4).toLowerCase()
    if (brand.startsWith("qt")) return "quicktime"
    return "mp4"
  }

  return null
}

export interface MimeValidationResult {
  valid: boolean
  detected: SniffedMediaKind | null
  reason?: string
}

/**
 * Validates that the first bytes of a file body actually match the
 * client-declared Content-Type. Call after reading the file into an
 * ArrayBuffer (the upload routes already do this before storing).
 *
 * Rejects (valid: false) when:
 *  - No known signature is detected at all (unrecognized/unsupported binary,
 *    including SVG/XML which has no binary magic-byte signature to match)
 *  - A signature IS detected but doesn't correspond to the declared MIME type
 */
export function validateMagicBytes(
  buffer: ArrayBuffer | Uint8Array,
  declaredContentType: string,
): MimeValidationResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const detected = sniffMediaKind(bytes)

  if (!detected) {
    return {
      valid:    false,
      detected: null,
      reason:   "Could not verify file contents match a supported image/video format.",
    }
  }

  const allowed = KIND_TO_ALLOWED_MIME[detected]
  if (!allowed.includes(declaredContentType)) {
    return {
      valid:    false,
      detected,
      reason:   `File contents look like "${detected}" but were declared as "${declaredContentType}".`,
    }
  }

  return { valid: true, detected }
}
