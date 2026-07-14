/**
 * compress-image.ts
 *
 * Client-side image compression via Canvas API.
 * No dependencies — runs entirely in the browser.
 *
 * Targets (P4, 2026-07-14 — media efficiency pass):
 *   JPEG / WebP        → only resized when longest side > 2048px, JPEG 85%
 *   PNG                → only resized when longest side > 2048px, stays PNG
 *                        (never recompressed to JPEG — preserves transparency)
 *   HEIC               → heic2any → canvas resize (only if > 2048px) → JPEG 85%
 *   GIF                → passed through unchanged (animation not supported)
 *
 * Images already at or under 2048px on their longest side are returned
 * untouched — no lossy recompression for no reason.
 *
 * Usage:
 *   const compressed = await compressImage(file)
 */

const MAX_PX  = 2048
const QUALITY = 0.85

export async function compressImage(file: File): Promise<File> {
  // GIF: pass through — canvas kills animation
  if (file.type === "image/gif") return file

  // HEIC: convert first via heic2any (→ JPEG), then fall through to canvas resize
  const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")

  let source: File | Blob = file
  let outputIsPng = file.type === "image/png"

  if (isHeic) {
    source = await convertHeic(file)
    outputIsPng = false // heic2any always outputs JPEG
  }

  return resizeIfOverLimit(source, file.name, outputIsPng)
}

/** Returns true if the file should be passed through compressImage() before upload */
export function shouldCompressImage(file: File): boolean {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return (
    type === "image/jpeg" ||
    type === "image/jpg"  ||
    type === "image/png"  ||
    type === "image/webp" ||
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  )
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function convertHeic(file: File): Promise<Blob> {
  // Dynamically import heic2any — only loaded when a HEIC file is dropped
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heic2any = ((await import("heic2any")) as any).default ?? (await import("heic2any"))
  const result   = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })
  return Array.isArray(result) ? result[0] : result as Blob
}

/**
 * Resizes only when the longest side exceeds MAX_PX (2048px). Images already
 * within the limit are returned as-is — never recompressed, never re-encoded.
 */
async function resizeIfOverLimit(source: File | Blob, originalName: string, outputIsPng: boolean): Promise<File> {
  const bitmap = await createImageBitmap(source)
  const { width: origW, height: origH } = bitmap

  if (origW <= MAX_PX && origH <= MAX_PX) {
    bitmap.close()
    // Already within limits — return untouched (normalise to File for callers)
    return source instanceof File ? source : new File([source], originalName, { type: source.type })
  }

  let targetW = origW
  let targetH = origH
  if (origW > origH) {
    targetW = MAX_PX
    targetH = Math.round(origH * (MAX_PX / origW))
  } else {
    targetH = MAX_PX
    targetW = Math.round(origW * (MAX_PX / origH))
  }

  const canvas = new OffscreenCanvas(targetW, targetH)
  const ctx    = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()

  const blob = outputIsPng
    ? await canvas.convertToBlob({ type: "image/png" })
    : await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY })

  const ext = outputIsPng ? ".png" : ".jpg"
  const mimeType = outputIsPng ? "image/png" : "image/jpeg"
  const compressedName = originalName.replace(/\.[^.]+$/, "") + "_compressed" + ext

  return new File([blob], compressedName, { type: mimeType })
}
