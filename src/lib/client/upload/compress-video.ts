/**
 * compress-video.ts
 *
 * Client-side video compression via ffmpeg.wasm.
 * Runs entirely in the browser — no server round-trip.
 *
 * Target: 720p / H.264 / CRF 26
 * MOV files are automatically transcoded to MP4.
 * Returns a compressed File ready to upload.
 *
 * Requires COOP/COEP headers on the page (set in next.config.ts for /upload).
 *
 * Usage:
 *   const compressed = await compressVideo(file, (progress) => setProgress(progress))
 */

import { FFmpeg }        from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

export type ProgressCallback = (pct: number) => void

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  const ffmpeg = new FFmpeg()

  // Load ffmpeg.wasm core from CDN — avoids bundling the ~30MB binary
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
  await ffmpeg.load({
    coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   "text/javascript"),
    wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })

  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function compressVideo(
  file:       File,
  onProgress?: ProgressCallback,
): Promise<File> {
  const ffmpeg = await getFFmpeg()

  onProgress?.(0)

  // Wire ffmpeg progress to our callback (0–100)
  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.round(progress * 100))
  })

  const inputName  = "input"  + file.name.slice(file.name.lastIndexOf("."))
  const outputName = "output.mp4"

  // Write the file into ffmpeg's virtual FS
  await ffmpeg.writeFile(inputName, await fetchFile(file))

  // Compress to 720p H.264 CRF 26, copy audio stream
  await ffmpeg.exec([
    "-i",        inputName,
    "-vf",       "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
    "-c:v",      "libx264",
    "-crf",      "26",
    "-preset",   "fast",
    "-c:a",      "aac",
    "-b:a",      "128k",
    "-movflags", "+faststart",
    outputName,
  ])

  const data = await ffmpeg.readFile(outputName)

  // Clean up virtual FS
  await ffmpeg.deleteFile(inputName).catch(() => null)
  await ffmpeg.deleteFile(outputName).catch(() => null)

  // data may be Uint8Array or string — normalise to a plain ArrayBuffer for Blob
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw   = data as any
  const uint8 = raw instanceof Uint8Array ? raw : new TextEncoder().encode(String(raw))
  // Copy into a plain ArrayBuffer (avoids SharedArrayBuffer Blob restriction)
  const buf   = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer
  const blob  = new Blob([buf], { type: "video/mp4" })
  const compressedName = file.name.replace(/\.[^.]+$/, "") + "_compressed.mp4"

  onProgress?.(100)

  return new File([blob], compressedName, { type: "video/mp4" })
}

/** Returns true if the file should be compressed before upload */
export function shouldCompressVideo(file: File): boolean {
  const type = file.type.toLowerCase()
  return (
    type === "video/mp4"       ||
    type === "video/quicktime" ||  // MOV
    type === "video/mov"       ||
    type === "video/avi"       ||
    type === "video/webm"
  )
}
