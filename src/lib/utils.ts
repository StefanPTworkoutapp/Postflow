import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Human-readable file size, e.g. formatBytes(48_300_000) -> "46.1 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

/** Short "compressed X → Y" feedback string, or null if not meaningfully compressed. */
export function compressionFeedback(originalBytes: number, uploadedBytes: number): string | null {
  if (uploadedBytes >= originalBytes * 0.98) return null
  return `Compressed ${formatBytes(originalBytes)} → ${formatBytes(uploadedBytes)}`
}
