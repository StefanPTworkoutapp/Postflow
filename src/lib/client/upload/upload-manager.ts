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

export interface UploadResult {
  path:      string
  publicUrl: string
  mediaId:   string
}

export interface UploadOptions {
  brandId?:       string
  onStageChange?: (stage: UploadStage) => void
  onProgress?:    (pct: number) => void
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function uploadFile(
  file:    File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const { brandId, onStageChange, onProgress } = options

  const setStage = (s: UploadStage) => onStageChange?.(s)
  const setProgress = (p: number) => onProgress?.(p)

  // ── Step 1: Compress ───────────────────────────────────────────────────────
  let fileToUpload = file

  if (shouldCompressVideo(file)) {
    setStage("compressing")
    setProgress(0)
    try {
      fileToUpload = await compressVideo(file, pct => setProgress(Math.round(pct * 0.6)))
    } catch (err) {
      console.warn("[upload-manager] Video compression failed, uploading original:", err)
      fileToUpload = file
    }
  } else if (shouldCompressImage(file)) {
    setStage("compressing")
    setProgress(0)
    try {
      fileToUpload = await compressImage(file)
    } catch (err) {
      console.warn("[upload-manager] Image compression failed, uploading original:", err)
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
      throw new Error(urlData.error ?? "Failed to get upload URL")
    }

    const uploadRes = await fetch(urlData.signedUrl, {
      method:  "PUT",
      headers: { "Content-Type": fileToUpload.type },
      body:    fileToUpload,
    })
    if (!uploadRes.ok) throw new Error(`Storage upload failed (${uploadRes.status})`)

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
  const confirmData = await confirmRes.json() as { mediaId?: string; error?: string }
  if (confirmData.error) throw new Error(confirmData.error)

  setStage("done")
  setProgress(100)

  return {
    path,
    publicUrl,
    mediaId: confirmData.mediaId ?? "",
  }
}
