/**
 * prepare-media-file.ts
 *
 * Shared client-side pre-upload step for components that build their own
 * FormData and POST directly to a route (calendar upload-media, carousel
 * slide-media, stories upload) rather than going through the full
 * upload-manager.ts pipeline (signed-URL + media_uploads confirm flow).
 *
 * Applies the same compression rules as upload-manager.ts:
 *   - video > 80MB  → ffmpeg.wasm downscale to 1080p (compress-video.ts)
 *   - image > 2048px longest side → canvas downscale, JPEG 85% / keep PNG (compress-image.ts)
 *   - GIFs and already-small files are left untouched
 *
 * `keepOriginalQuality: true` bypasses all compression for this one call —
 * nothing is persisted, the caller re-decides per upload.
 */

import { compressImage, shouldCompressImage } from "./compress-image"
import { compressVideo, shouldCompressVideo } from "./compress-video"

export interface PrepareMediaOptions {
  keepOriginalQuality?: boolean
  onProgress?: (pct: number) => void
}

export interface PrepareMediaResult {
  file:          File
  originalBytes: number
  uploadedBytes: number
  compressed:    boolean
}

export async function prepareMediaFile(
  file:    File,
  options: PrepareMediaOptions = {},
): Promise<PrepareMediaResult> {
  const { keepOriginalQuality, onProgress } = options

  if (keepOriginalQuality) {
    return { file, originalBytes: file.size, uploadedBytes: file.size, compressed: false }
  }

  if (shouldCompressVideo(file)) {
    try {
      const compressedFile = await compressVideo(file, onProgress)
      return { file: compressedFile, originalBytes: file.size, uploadedBytes: compressedFile.size, compressed: true }
    } catch (err) {
      console.warn("[prepare-media-file] video compression failed, uploading original:", err)
      return { file, originalBytes: file.size, uploadedBytes: file.size, compressed: false }
    }
  }

  if (shouldCompressImage(file)) {
    try {
      const compressedFile = await compressImage(file)
      return {
        file:          compressedFile,
        originalBytes: file.size,
        uploadedBytes: compressedFile.size,
        compressed:    compressedFile.size < file.size,
      }
    } catch (err) {
      console.warn("[prepare-media-file] image compression failed, uploading original:", err)
      return { file, originalBytes: file.size, uploadedBytes: file.size, compressed: false }
    }
  }

  return { file, originalBytes: file.size, uploadedBytes: file.size, compressed: false }
}
