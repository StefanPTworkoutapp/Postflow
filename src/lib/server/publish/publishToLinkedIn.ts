/**
 * Publishes a post to LinkedIn via the LinkedIn REST API (version 202406).
 *
 * Supported content types:
 *   - Text-only posts
 *   - Image posts (Phase 2 — currently posted as text with an attachment note;
 *     see Phase 2 comment below for the full server-side upload flow)
 *
 * API reference:
 *   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 *
 * Auth: OAuth 2.0 user token with w_member_social scope.
 * The token and member ID are fetched from postflow.social_accounts for the given brand.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { PublishInput, PublishResult } from "./types"

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest"
const LINKEDIN_VERSION = "202406"

function buildCommentary(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((h) => `#${h}`).join(" ")
  return hashtagLine ? `${caption}\n\n${hashtagLine}` : caption
}

export async function publishToLinkedIn(input: PublishInput): Promise<PublishResult> {
  const db = createServiceClient()

  const { data: account, error: accountError } = await db
    .from("social_accounts")
    .select("platform_access_token, platform_account_id")
    .eq("brand_id", input.brandId)
    .eq("platform", "linkedin")
    .eq("is_active", true)
    .single()

  if (accountError || !account) {
    throw new Error(
      "LinkedIn account not connected for this brand. Please reconnect your LinkedIn account in Settings."
    )
  }

  if (!account.platform_access_token) {
    throw new Error(
      "LinkedIn access token is missing. Please reconnect your LinkedIn account in Settings."
    )
  }

  if (!account.platform_account_id) {
    throw new Error(
      "LinkedIn member ID is missing. Please reconnect your LinkedIn account in Settings."
    )
  }

  const authorUrn = `urn:li:person:${account.platform_account_id}`

  let commentary = buildCommentary(input.caption, input.hashtags)

  // Phase 2: LinkedIn image upload requires a multi-step server-side flow:
  //   1. POST /rest/images?action=initializeUpload to get an upload URL + image URN
  //   2. PUT to the upload URL with the raw binary (no auth header)
  //   3. Include the image URN in the post body under content.media
  // Until Phase 2 is implemented, image posts are published as text with a note
  // so the user's intent is never silently dropped.
  if (input.mediaUrls.length > 0) {
    commentary = `${commentary}\n\n📎 [Image attached]`
  }

  const postBody = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  }

  const response = await fetch(`${LINKEDIN_API_BASE}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.platform_access_token}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  })

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`
    try {
      const errorBody = await response.json()
      const liMessage = errorBody?.message ?? errorBody?.errorDetails ?? JSON.stringify(errorBody)
      errorDetail = `HTTP ${response.status} — ${liMessage}`
    } catch {
      // Response body was not JSON; use status only
    }
    console.error("[publishToLinkedIn] API error:", errorDetail)
    throw new Error(`LinkedIn post failed: ${errorDetail}`)
  }

  // LinkedIn 201 response carries no JSON body; the post URN is in the X-RestLi-Id header.
  const postUrn = response.headers.get("X-RestLi-Id") ?? response.headers.get("x-restli-id")

  if (!postUrn) {
    throw new Error(
      "LinkedIn post was created but no post ID was returned. The post may have published successfully — check your LinkedIn profile to confirm."
    )
  }

  // LinkedIn URN format: urn:li:share:7xxxxxxxxxxxxxxx
  // Direct post URLs use the numeric ID portion.
  const urnParts = postUrn.split(":")
  const numericId = urnParts[urnParts.length - 1]
  const postedUrl = numericId
    ? `https://www.linkedin.com/feed/update/${postUrn}/`
    : undefined

  return {
    publishedId: postUrn,
    postedUrl,
  }
}
