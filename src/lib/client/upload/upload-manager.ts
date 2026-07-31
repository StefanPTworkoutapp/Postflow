/**
 * upload-manager.ts
 *
 * Orchestrates the full upload pipeline for a single file:
 *
 *   1. Compress   — video: ffmpeg.wasm 720p; image: canvas 1200px JPEG
 *   2. Sign       — POST /api/media/upload-url (existing route)
 *   3. Upload     — PUT to signed Supabase URL  (≤50MB) or TUS chunked (>50MB)
 *   4. Confirm    — POST /api/media/confirm (existing route)
 *
 * Exposes a granular status so the UI can show compression vs upload progress.
 *
 * Usage:
 *   const result = await uploadFile(file, brandId, {
 *     onStageChange: (stage) => console.log(stage),
 *     onProgress:    (pct)   => setProgress(pct),
 *   })
 */

import { compressVideo, shouldCompressVideo } from "./compress-video"
import { compressImage, shouldCompressImage } from "./compress-image"
import { chunkedUpload, MAX_DIRECT_SIZE }     from "./chunked-upload"

// ── Types ────────────────────────────────────────────────────────────────────

export type UploadStage =
  | "idle"
  | "compressing"
  | "uploading"
  | "confirming"
  | "done"
  | "error"

/** Human-readable error messages for common upload failures. */
function friendlyError(err: unknown, context: "compress" | "sign" | "upload" | "confirm"): string {
  const raw = err instanceof Error ? err.message : String(err)

  // Pass through our own already-friendly messages
  if (raw.includes("Could not load") || raw.includes("Video compression failed") || raw.includes("Could not read")) {
    return raw
  }

  if (context === "compress") {
    return `Compression failed — try enabling "Keep original quality" to skip it, or convert the file to MP4 first.`
  }
  if (context === "sign") {
    if (raw.toLowerCase().includes("storage limit") || raw.toLowerCase().includes("quota")) {
      return "You've reached your storage limit. Delete some files or upgrade your plan to free up space."
    }
    if (raw.toLowerCase().includes("too large")) return raw
    if (raw.toLowerCase().includes("not allowed")) return raw
    return `Could not prepare upload: ${raw}`
  }
  if (context === "upload") {
    if (raw.includes("413")) return "File is too large for the server. Try enabling compression or split the video into shorter clips."
    if (raw.includes("403") || raw.includes("401")) return "Upload permission expired. Refresh the page and try again."
    return "Upload failed — check your internet connection and try again."
  }
  if (context === "confirm") {
    return `File uploaded but could not be saved: ${raw}. Contact support if this keeps happening.`
  }
  return raw
}

export interface UploadResult {
  path:      string
  publicUrl: string
  mediaId:   string
}

export interface UploadOptions {
  brandId?:       string
  /** Per-upload opt-out of client-side compression/downscaling. Nothing is persisted — the user re-chooses every time. */
  keepOriginalQuality?: boolean
  onStageChange?: (stage: UploadStage) => void
  onProgress?:    (pct: number) => void
}

export interface UploadResultWithSizes extends UploadResult {
  /** Original file size in bytes, before any client-side compression. */
  originalBytes:     number
  /** Size actually uploaded, in bytes (== originalBytes when uncompressed or keepOriginalQuality was set). */
  uploadedBytes:     number
  compressed:        boolean
  /** Set when compression was attempted but failed and the original was uploaded instead. */
  compressionWarning?: string
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function uploadFile(
  file:    File,
  options: UploadOptions = {},
): Promise<UploadResultWithSizes> {
  const { brandId, keepOriginalQuality, onStageChange, onProgress } = options

  const setStage = (s: UploadStage) => onStageChange?.(s)
  const setProgress = (p: number) => onProgress?.(p)

  // ── Step 1: Compress ───────────────────────────────────────────────────────
  let fileToUpload = file
  let compressed = false
  let compressionWarning: string | undefined

  if (!keepOriginalQuality && shouldCompressVideo(file)) {
    setStage("compressing")
    setProgress(0)
    try {
      fileToUpload = await compressVideo(file, pct => setProgress(Math.round(pct * 0.6)))
      compressed = true
    } catch (err) {
      // Surface compression failure as a warning but continue with the original file
      compressionWarning = friendlyError(err, "compress")
      fileToUpload = file
    }
  } else if (!keepOriginalQuality && shouldCompressImage(file)) {
    setStage("compressing")
    setProgress(0)
    try {
      fileToUpload = await compressImage(file)
      compressed = fileToUpload !== file && fileToUpload.size !== file.size
    } catch {
      fileToUpload = file
    }
  }

  // ── Step 2 & 3: Upload ────────────────────────────────────────────────────
  setStage("uploading")
  setProgress(60)

  let path:      string
  let publicUrl: string

  if (brandId && fileToUpload.size > MAX_DIRECT_SIZE) {
    // Large file: TUS chunked upload
    const result = await chunkedUpload(fileToUpload, brandId, pct =>
      setProgress(60 + Math.round(pct * 0.3))
    )
    path      = result.path
    publicUrl = result.publicUrl
  } else {
    // Normal: signed URL upload
    const urlRes = await fetch("/api/media/upload-url", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        filename:    fileToUpload.name,
        contentType: fileToUpload.type,
        size:        fileToUpload.size,
      }),
    })
    const urlData = await urlRes.json() as {
      signedUrl?: string; path?: string; publicUrl?: string; error?: string
    }
    if (urlData.error || !urlData.signedUrl) {
      throw new Error(friendlyError(urlData.error ?? "Failed to get upload URL", "sign"))
    }

    let uploadRes: Response
    try {
      uploadRes = await fetch(urlData.signedUrl, {
        method:  "PUT",
        headers: { "Content-Type": fileToUpload.type },
        body:    fileToUpload,
      })
    } catch {
      throw new Error(friendlyError("network", "upload"))
    }
    if (!uploadRes.ok) {
      throw new Error(friendlyError(`${uploadRes.status}`, "upload"))
    }

    path      = urlData.path!
    publicUrl = urlData.publicUrl!
  }

  setProgress(90)

  // ── Step 4: Confirm ───────────────────────────────────────────────────────
  setStage("confirming")

  const confirmRes = await fetch("/api/media/confirm", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      path,
      publicUrl,
      filename:    file.name,          // original filename for display
      contentType: fileToUpload.type,
      size:        fileToUpload.size,
    }),
  })
  const confirmData = await confirmRes.json() as { mediaId?: string; media?: { id: string }; error?: string }
  if (confirmData.error) throw new Error(friendlyError(confirmData.error, "confirm"))

  setStage("done")
  setProgress(100)

  return {
    path,
    publicUrl,
    mediaId:           confirmData.mediaId ?? confirmData.media?.id ?? "",
    originalBytes:     file.size,
    uploadedBytes:     fileToUpload.size,
    compressed,
    compressionWarning,
  }
}
