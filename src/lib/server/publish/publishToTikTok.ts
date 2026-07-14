/**
 * Publishes a video to TikTok via the TikTok Content Posting API v2.
 *
 * ⚠️  GATED BEHIND TIKTOK_DIRECT_PUBLISH_ENABLED
 *
 * TikTok denied PostFlow's production app submission for the video.publish scope
 * (2026-07). Real publishing code is preserved below (restored from git history at
 * commit a3eb5a3, before it was hard-disabled at d81502b) but is gated behind the
 * TIKTOK_DIRECT_PUBLISH_ENABLED env flag so it stays inert until TikTok re-approves
 * the app — flipping one env var re-enables it with no further code change.
 *
 * STATUS:
 *   TIKTOK_DIRECT_PUBLISH_ENABLED !== 'true' (default, unset) → throws
 *   TIKTOK_PUBLISHING_PENDING immediately, same behavior as before this change.
 *   The schedule route catches this and returns a 422 with needsBuffer: true,
 *   so users are directed to connect Buffer for TikTok publishing in the meantime.
 *
 *   TIKTOK_DIRECT_PUBLISH_ENABLED === 'true' → runs the real publish flow below.
 *
 * TO RE-ENABLE IN AN ENVIRONMENT:
 *   1. Confirm TikTok has approved the production app for the video.publish scope
 *   2. Set TIKTOK_DIRECT_PUBLISH_ENABLED=true in that environment (Vercel/.env.local)
 *   3. /api/auth/tiktok/route.ts automatically adds "video.publish" to the OAuth
 *      scope list once this same flag is true — no separate edit needed
 *   4. Ask existing TikTok-connected users to reconnect (their stored token predates
 *      the video.publish scope and will fail with an insufficient_scope error otherwise)
 *
 * API reference:
 *   https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *
 * Auth: TikTok OAuth 2.0 access token stored in postflow.social_accounts.platform_access_token.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { PublishInput, PublishResult } from "./types"

const TIKTOK_POST_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"
const MAX_TITLE_LENGTH = 150

/** Sentinel error code the schedule route checks to surface a user-friendly message. */
export const TIKTOK_PUBLISHING_PENDING = "TIKTOK_PUBLISHING_PENDING"

/** True when TikTok direct publishing is live in this environment. */
export function isTikTokDirectPublishEnabled(): boolean {
  return process.env.TIKTOK_DIRECT_PUBLISH_ENABLED === "true"
}

function throwPendingApproval(): never {
  const err = new Error(
    "TikTok direct publishing is pending app approval. " +
    "Connect Buffer in Settings to publish TikTok posts in the meantime."
  )
  ;(err as Error & { code: string }).code = TIKTOK_PUBLISHING_PENDING
  throw err
}

export async function publishToTikTok(input: PublishInput): Promise<PublishResult> {
  if (!isTikTokDirectPublishEnabled()) {
    throwPendingApproval()
  }

  const db = createServiceClient()

  const { data: account, error: accountError } = await db
    .from("social_accounts")
    .select("platform_access_token, platform_account_id")
    .eq("brand_id", input.brandId)
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .single()

  if (accountError || !account) {
    throw new Error(
      "TikTok account not connected for this brand. Please connect your TikTok account in Settings."
    )
  }

  if (!account.platform_access_token) {
    throw new Error(
      "TikTok not connected. Please connect your TikTok account in Settings."
    )
  }

  if (input.mediaUrls.length === 0) {
    throw new Error(
      "TikTok requires a video file. Please attach a video to this post before publishing to TikTok."
    )
  }

  const title = input.caption.length > MAX_TITLE_LENGTH
    ? input.caption.slice(0, MAX_TITLE_LENGTH - 1) + "…"
    : input.caption

  const requestBody = {
    post_info: {
      title,
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_duet: false,
      disable_stitch: false,
      disable_comment: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: input.mediaUrls[0],
    },
  }

  const response = await fetch(TIKTOK_POST_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.platform_access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  const body = (await response.json()) as {
    data?: { publish_id?: string }
    error?: { code?: string | number; message?: string }
  }

  if (!response.ok || (body.error && body.error.code !== "ok")) {
    const code = body.error?.code ?? response.status
    const message = body.error?.message ?? `HTTP ${response.status}`
    console.error("[publishToTikTok] API error:", code, message)
    throw new Error(`TikTok post failed (${code}): ${message}`)
  }

  const publishId = body.data?.publish_id

  if (!publishId) {
    throw new Error(
      "TikTok accepted the request but did not return a publish ID. The video may be processing — check your TikTok account."
    )
  }

  // TikTok does not return a direct post URL at publish time; the video is processed
  // asynchronously. A post URL becomes available once TikTok has finished processing.
  return {
    publishedId: publishId,
    postedUrl: undefined,
  }
}
