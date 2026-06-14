/**
 * Publishes a post to a Facebook Page via the Facebook Graph API v21.0.
 *
 * Supported content types:
 *   - Text-only posts  → POST /{pageId}/feed
 *   - Single image     → POST /{pageId}/photos  (published=true)
 *   - Multiple images  → Posts first image with full caption
 *     (Facebook Pages API does not support true multi-photo carousels;
 *      carousel ads require the Ads API which is out of scope here.)
 *
 * API reference:
 *   https://developers.facebook.com/docs/graph-api/reference/page/feed/
 *   https://developers.facebook.com/docs/graph-api/reference/page/photos/
 *
 * Auth: Page access token stored in postflow.social_accounts.platform_access_token.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { PublishInput, PublishResult } from "./types"

const GRAPH_BASE = "https://graph.facebook.com/v21.0"

function buildMessage(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((h) => `#${h}`).join(" ")
  return hashtagLine ? `${caption}\n\n${hashtagLine}` : caption
}

/** Converts a Graph API `id` of the form "pageId_postId" into a post URL. */
function feedIdToUrl(id: string): string {
  // Feed post IDs are "{pageId}_{postId}" — the permalink uses /{pageId}/posts/{postId}
  const parts = id.split("_")
  if (parts.length === 2) {
    return `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
  }
  return `https://www.facebook.com/${id}`
}

export async function publishToFacebook(input: PublishInput): Promise<PublishResult> {
  const db = createServiceClient()

  const { data: account, error: accountError } = await db
    .from("social_accounts")
    .select("platform_access_token, platform_account_id")
    .eq("brand_id", input.brandId)
    .eq("platform", "facebook")
    .eq("is_active", true)
    .single()

  if (accountError || !account) {
    throw new Error(
      "Facebook Page not connected for this brand. Please reconnect your Facebook account in Settings."
    )
  }

  if (!account.platform_access_token) {
    throw new Error(
      "Facebook Page access token is missing. Please reconnect your Facebook account in Settings."
    )
  }

  if (!account.platform_account_id) {
    throw new Error(
      "Facebook Page ID is missing. Please reconnect your Facebook account in Settings."
    )
  }

  const pageId = account.platform_account_id
  const pageToken = account.platform_access_token
  const message = buildMessage(input.caption, input.hashtags)

  // Text-only post
  if (input.mediaUrls.length === 0) {
    const response = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: pageToken }),
    })

    const body = await response.json()

    if (!response.ok || body.error) {
      const detail = body.error?.message ?? `HTTP ${response.status}`
      console.error("[publishToFacebook] feed error:", detail)
      throw new Error(`Facebook post failed: ${detail}`)
    }

    // body.id is the feed post ID ("pageId_postId")
    const postId: string = body.id
    return {
      publishedId: postId,
      postedUrl: feedIdToUrl(postId),
    }
  }

  // Single image or multiple images — post the first image with the full caption.
  // For multiple images, Facebook Pages API does not support true multi-photo carousels
  // via the organic posts endpoint. Only the first image is published.
  const imageUrl = input.mediaUrls[0]

  const response = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      message,
      access_token: pageToken,
      published: true,
    }),
  })

  const body = await response.json()

  if (!response.ok || body.error) {
    const detail = body.error?.message ?? `HTTP ${response.status}`
    console.error("[publishToFacebook] photos error:", detail)
    throw new Error(`Facebook photo post failed: ${detail}`)
  }

  // Photos endpoint returns { id: "photoId", post_id: "pageId_postId" }
  // post_id is the feed-level ID we want for the URL.
  const postId: string = body.post_id ?? body.id
  return {
    publishedId: postId,
    postedUrl: feedIdToUrl(postId),
  }
}
