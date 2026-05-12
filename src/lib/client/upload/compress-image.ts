/**
 * compress-image.ts
 *
 * Client-side image compression via Canvas API.
 * No dependencies — runs entirely in the browser.
 *
 * Targets:
 *   JPEG / WebP / PNG  → 1200px longest side, JPEG 85%
 *   HEIC               → heic2any → canvas resize → JPEG 85%
 *   GIF                → passed through unchanged (animation not supported)
 *
 * Usage:
 *   const compressed = await compressImage(file)
 */

export async function compressImage(file: File): Promise<File> {
  // GIF: pass through — canvas kills animation
  if (file.type === "image/gif") return file

  // HEIC: convert first via heic2any, then fall through to canvas resize
  let source: File | Blob = file
  if (file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
    source = await convertHeic(file)
  }

  return resizeToJpeg(source, file.name)
}

/** Returns true if the file should be compressed before upload */
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

async function resizeToJpeg(source: File | Blob, originalName: string): Promise<File> {
  const MAX_PX = 1200
  const QUALITY = 0.85

  const bitmap = await createImageBitmap(source)

  const { width: origW, height: origH } = bitmap

  // Scale down only — never upscale
  let targetW = origW
  let targetH = origH
  if (origW > MAX_PX || origH > MAX_PX) {
    if (origW > origH) {
      targetW = MAX_PX
      targetH = Math.round(origH * (MAX_PX / origW))
    } else {
      targetH = MAX_PX
      targetW = Math.round(origW * (MAX_PX / origH))
    }
  }

  const canvas = new OffscreenCanvas(targetW, targetH)
  const ctx    = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()

  const blob         = await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY })
  const compressedName = originalName.replace(/\.[^.]+$/, "") + "_compressed.jpg"

  return new File([blob], compressedName, { type: "image/jpeg" })
}
