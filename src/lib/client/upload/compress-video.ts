/**
 * compress-video.ts
 *
 * Client-side video compression via ffmpeg.wasm (single-thread build).
 * Runs entirely in the browser — no server round-trip.
 * Works on every route — does NOT require COOP/COEP headers because it
 * uses @ffmpeg/core-st (single-thread) which avoids SharedArrayBuffer.
 *
 * Target: 1080p max / H.264 / CRF 26 / AAC 128k.
 * Applied to all video files over COMPRESS_THRESHOLD_BYTES (20 MB).
 * MOV/AVI/WebM are transcoded to MP4.
 *
 * Throws on failure — callers must handle and surface the error to the user.
 */

import { FFmpeg }              from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

export type ProgressCallback = (pct: number) => void

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  const ffmpeg = new FFmpeg()

  // Single-thread build — no SharedArrayBuffer / COOP/COEP headers needed.
  const baseURL = "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/umd"
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`,   "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })

  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function compressVideo(
  file:        File,
  onProgress?: ProgressCallback,
): Promise<File> {
  let ffmpeg: FFmpeg
  try {
    ffmpeg = await getFFmpeg()
  } catch {
    throw new Error("Could not load the video compressor. Check your internet connection and try again.")
  }

  onProgress?.(0)

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.min(99, Math.round(progress * 100)))
  })

  const inputName  = "input" + file.name.slice(file.name.lastIndexOf("."))
  const outputName = "output.mp4"

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))
  } catch {
    throw new Error("Could not read the video file. It may be corrupted or too large for your browser.")
  }

  try {
    await ffmpeg.exec([
      "-i",        inputName,
      "-vf",       "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
      "-c:v",      "libx264",
      "-crf",      "26",
      "-preset",   "fast",
      "-c:a",      "aac",
      "-b:a",      "128k",
      "-movflags", "+faststart",
      outputName,
    ])
  } catch {
    throw new Error("Video compression failed. Try using 'Keep original quality' to skip compression, or convert the file to MP4 first.")
  }

  const data = await ffmpeg.readFile(outputName)

  await ffmpeg.deleteFile(inputName).catch(() => null)
  await ffmpeg.deleteFile(outputName).catch(() => null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw   = data as any
  const uint8 = raw instanceof Uint8Array ? raw : new TextEncoder().encode(String(raw))
  const buf   = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer
  const blob  = new Blob([buf], { type: "video/mp4" })

  onProgress?.(100)

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + "_compressed.mp4",
    { type: "video/mp4" },
  )
}

/** Videos over this size are compressed before upload. */
export const COMPRESS_THRESHOLD_BYTES = 20 * 1024 * 1024 // 20 MB

export function shouldCompressVideo(file: File): boolean {
  const type = file.type.toLowerCase()
  const isVideo =
    type === "video/mp4"       ||
    type === "video/quicktime" ||
    type === "video/mov"       ||
    type === "video/avi"       ||
    type === "video/webm"
  return isVideo && file.size > COMPRESS_THRESHOLD_BYTES
}
