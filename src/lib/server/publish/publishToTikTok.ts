/**
 * Publishes a video to TikTok via the TikTok Content Posting API v2.
 *
 * ⚠️  PUBLISHING TEMPORARILY DISABLED
 *
 * TikTok denied PostFlow's production app submission for the video.publish scope.
 * Until the app is re-approved, this function throws a clear user-facing error
 * rather than making an API call that would fail silently.
 *
 * STATUS: publishToTikTok throws TIKTOK_PUBLISHING_PENDING immediately.
 * The schedule route catches this and returns a 422 with needsBuffer: true,
 * so users are directed to connect Buffer for TikTok publishing in the meantime.
 *
 * TO RE-ENABLE:
 *   1. Re-submit TikTok production app with video demo + privacy policy URL
 *   2. Once approved, update /api/auth/tiktok/route.ts scopes to include "video.publish"
 *   3. Ask existing TikTok-connected users to reconnect
 *   4. Remove the early-throw in this file
 *
 * API reference (for when re-enabled):
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

export async function publishToTikTok(_input: PublishInput): Promise<PublishResult> {
  // TikTok direct publishing is temporarily disabled — production app denied.
  // Throw a sentinel the caller can catch and route to Buffer instead.
  const err = new Error(
    "TikTok direct publishing is pending app approval. " +
    "Connect Buffer in Settings to publish TikTok posts in the meantime."
  )
  ;(err as Error & { code: string }).code = TIKTOK_PUBLISHING_PENDING
  throw err
}
