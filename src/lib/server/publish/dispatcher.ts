/**
 * Publish dispatcher — routes a PublishInput to the correct platform publisher.
 *
 * Five platforms (LinkedIn, Facebook, Instagram, TikTok, Threads) are handled
 * here with native API calls and no third-party SDK. Any platform not listed in
 * DIRECT_PUBLISH_PLATFORMS should be routed through Buffer instead.
 *
 * Note: TikTok is listed here but publishToTikTok internally gates on
 * TIKTOK_DIRECT_PUBLISH_ENABLED — see publishToTikTok.ts header for re-enable steps.
 *
 * Usage:
 *   import { dispatchPublish } from "@/lib/server/publish/dispatcher"
 *   const result = await dispatchPublish(input)
 */

import type { PublishInput, PublishResult } from "./types"
import { publishToLinkedIn }  from "./publishToLinkedIn"
import { publishToFacebook }  from "./publishToFacebook"
import { publishToInstagram } from "./publishToInstagram"
import { publishToTikTok }    from "./publishToTikTok"
import { publishToThreads }   from "./publishToThreads"

export async function dispatchPublish(input: PublishInput): Promise<PublishResult> {
  switch (input.platform) {
    case "linkedin":  return publishToLinkedIn(input)
    case "facebook":  return publishToFacebook(input)
    case "instagram": return publishToInstagram(input)
    case "tiktok":    return publishToTikTok(input)
    case "threads":   return publishToThreads(input)
    default:
      throw new Error(
        `No direct publisher for platform: ${input.platform}. Use Buffer for this platform.`
      )
  }
}

export const DIRECT_PUBLISH_PLATFORMS = ["linkedin", "facebook", "instagram", "tiktok", "threads"] as const
export type DirectPublishPlatform = typeof DIRECT_PUBLISH_PLATFORMS[number]

/** Type guard — returns true if PostFlow can publish to this platform directly */
export function isDirectPublishPlatform(platform: string): platform is DirectPublishPlatform {
  return (DIRECT_PUBLISH_PLATFORMS as readonly string[]).includes(platform)
}
