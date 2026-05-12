/**
 * url-validator — Platform detection and URL validation for inspiration posts.
 *
 * Supports: Instagram, TikTok (YouTube reserved for later).
 * Returns a typed result so callers know exactly what failed without
 * throwing exceptions into control flow.
 */

export type SupportedPlatform = "instagram" | "tiktok"

export interface ValidUrl {
  ok:       true
  platform: SupportedPlatform
  url:      string            // normalised canonical URL
}

export interface InvalidUrl {
  ok:       false
  reason:   "invalid_url" | "unsupported_platform"
  message:  string
}

export type UrlValidationResult = ValidUrl | InvalidUrl

// Patterns that reliably identify the platform from the URL structure.
// Instagram: /p/{code}/, /reel/{code}/, /tv/{code}/
// TikTok:    @{user}/video/{id}, /video/{id}
const INSTAGRAM_RE = /instagram\.com\/(?:p|reel|tv)\/[\w-]+/i
const TIKTOK_RE    = /tiktok\.com\/@[\w.]+\/video\/\d+|tiktok\.com\/t\/[\w]+/i

export function validateInspirationUrl(rawUrl: string): UrlValidationResult {
  // 1. Must be a parseable URL
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return {
      ok:      false,
      reason:  "invalid_url",
      message: "That doesn't look like a valid URL. Please paste the full link from Instagram or TikTok.",
    }
  }

  // 2. Must be HTTPS
  if (parsed.protocol !== "https:") {
    return {
      ok:      false,
      reason:  "invalid_url",
      message: "Please use the full https:// link copied from the app.",
    }
  }

  const href = parsed.href

  if (INSTAGRAM_RE.test(href)) {
    return { ok: true, platform: "instagram", url: href }
  }

  if (TIKTOK_RE.test(href)) {
    return { ok: true, platform: "tiktok", url: href }
  }

  // Detect known-but-unsupported platforms for a better error message
  const host = parsed.hostname.replace(/^www\./, "")
  if (host === "youtube.com" || host === "youtu.be") {
    return {
      ok:      false,
      reason:  "unsupported_platform",
      message: "PostFlow currently supports Instagram and TikTok links.",
    }
  }

  return {
    ok:      false,
    reason:  "unsupported_platform",
    message: "PostFlow currently supports Instagram and TikTok links.",
  }
}
