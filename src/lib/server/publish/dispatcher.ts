/**
 * Publish dispatcher — routes a PublishInput to the correct platform publisher.
 *
 * All four supported platforms (LinkedIn, Facebook, Instagram, TikTok) are handled
 * here with native API calls and no third-party SDK. Any platform not listed in
 * DIRECT_PUBLISH_PLATFORMS should be routed through Buffer instead.
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

export async function dispatchPublish(input: PublishInput): Promise<PublishResult> {
  switch (input.platform) {
    case "linkedin":  return publishToLinkedIn(input)
    case "facebook":  return publishToFacebook(input)
    case "instagram": return publishToInstagram(input)
    case "tiktok":    return publishToTikTok(input)
    default:
      throw new Error(
        `No direct publisher for platform: ${input.platform}. Use Buffer for this platform.`
      )
  }
}

export const DIRECT_PUBLISH_PLATFORMS = ["linkedin", "facebook", "instagram", "tiktok"] as const
export type DirectPublishPlatform = typeof DIRECT_PUBLISH_PLATFORMS[number]

/** Type guard — returns true if PostFlow can publish to this platform directly */
export function isDirectPublishPlatform(platform: string): platform is DirectPublishPlatform {
  return (DIRECT_PUBLISH_PLATFORMS as readonly string[]).includes(platform)
}
