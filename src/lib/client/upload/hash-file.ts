/**
 * Compute SHA-256 of a File using the Web Crypto API.
 * Returns a hex digest string, or null if the browser doesn't support
 * SubtleCrypto (extremely rare) or if the file is too large to buffer.
 *
 * Used before upload to detect duplicate files already in the media library.
 */
export async function hashFile(file: File): Promise<string | null> {
  try {
    if (!crypto?.subtle?.digest) return null
    const buffer = await file.arrayBuffer()
    const hashBuf = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
  } catch {
    return null
  }
}
