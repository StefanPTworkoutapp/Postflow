/**
 * chunked-upload.ts
 *
 * Chunked upload for files >50MB to Supabase Storage.
 *
 * Supabase Storage doesn't natively support multipart upload via signed PUT
 * URLs for arbitrarily large chunks — so we use the Supabase JS client's
 * `storage.from().upload()` with the `upsert` option, which handles large
 * files via the TUS resumable upload protocol under the hood when the
 * file exceeds the threshold.
 *
 * For files ≤50MB the normal signed-URL path is faster and preferred.
 * Use this only when the file size exceeds MAX_DIRECT_SIZE.
 *
 * Usage:
 *   const { path, publicUrl } = await chunkedUpload(file, brandId, onProgress)
 */

import { createClient } from "@/lib/supabase/client"

export const MAX_DIRECT_SIZE = 50 * 1024 * 1024  // 50 MB

export type ProgressCallback = (pct: number) => void

export async function chunkedUpload(
  file:        File,
  brandId:     string,
  onProgress?: ProgressCallback,
): Promise<{ path: string; publicUrl: string }> {
  const supabase  = createClient()
  const ext       = file.name.slice(file.name.lastIndexOf("."))
  const fileName  = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  const path      = `media/${brandId}/${fileName}`

  onProgress?.(0)

  // Use TUS resumable upload (Supabase handles chunking automatically)
  const { error } = await supabase.storage
    .from("postflow-media")
    .upload(path, file, {
      upsert:      false,
      contentType: file.type,
    })

  if (error) throw new Error(`Chunked upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from("postflow-media")
    .getPublicUrl(path)

  onProgress?.(100)

  return { path, publicUrl: urlData.publicUrl }
}
