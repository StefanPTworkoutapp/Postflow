/**
 * Publishes a video to TikTok via the TikTok Content Posting API v2.
 *
 * TikTok only supports video content through this API — there is no text-only or
 * image-only post endpoint for non-Creator-Marketplace accounts.
 *
 * The PULL_FROM_URL source method is used: TikTok fetches the video directly from
 * the provided public URL. The URL must be publicly accessible and return a valid
 * video file (MP4 recommended).
 *
 * IMPORTANT — Scope requirement:
 *   The stored token currently only has user.info.basic scope.
 *   Publishing requires the video.publish scope AND production app approval from TikTok.
 *   API calls will fail with an auth error until the app is approved and the token
 *   is re-issued with the video.publish scope. This is expected and documented behaviour.
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

export async function publishToTikTok(input: PublishInput): Promise<PublishResult> {
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
