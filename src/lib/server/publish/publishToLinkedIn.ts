/**
 * Publishes a post to LinkedIn via the LinkedIn REST API (version 202406).
 *
 * Supported content types:
 *   - Text-only posts         → POST /rest/posts (commentary only)
 *   - Single image posts      → initializeUpload → PUT binary → POST /rest/posts with image URN
 *   - Multiple images         → each image uploaded separately, first image used
 *     (LinkedIn native multi-image posts require the Articles API — out of scope for MVP;
 *      for now we use the first image and note the rest in the caption)
 *
 * LinkedIn image upload flow (3 steps):
 *   1. POST /rest/images?action=initializeUpload  →  { uploadUrl, image URN }
 *   2. PUT {uploadUrl} with raw image binary (no Authorization header — pre-signed)
 *   3. POST /rest/posts with content.media.id = image URN
 *
 * API reference:
 *   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 *   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
 *
 * Auth: OAuth 2.0 user token with w_member_social scope.
 * The token and member ID are fetched from postflow.social_accounts for the given brand.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { PublishInput, PublishResult } from "./types"

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest"
const LINKEDIN_VERSION  = "202406"

function buildCommentary(caption: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((h) => `#${h}`).join(" ")
  return hashtagLine ? `${caption}\n\n${hashtagLine}` : caption
}

/**
 * Step 1 of 3: Initialise a LinkedIn image upload.
 * Returns the pre-signed upload URL and the image URN to reference in the post.
 */
async function initLinkedInImageUpload(
  authorUrn: string,
  accessToken: string
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const res = await fetch(`${LINKEDIN_API_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization:              `Bearer ${accessToken}`,
      "LinkedIn-Version":          LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type":              "application/json",
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: authorUrn },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LinkedIn image init failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    value?: { uploadUrl?: string; image?: string }
  }

  const uploadUrl = data?.value?.uploadUrl
  const imageUrn  = data?.value?.image

  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn image init returned no uploadUrl or image URN")
  }

  return { uploadUrl, imageUrn }
}

/**
 * Step 2 of 3: Fetch the image from a public URL and PUT the raw binary
 * to LinkedIn's pre-signed upload URL.
 * No Authorization header on this request — LinkedIn's upload URL is pre-signed.
 */
async function uploadImageToLinkedIn(publicImageUrl: string, uploadUrl: string): Promise<void> {
  // Fetch the image binary from our storage
  const imageRes = await fetch(publicImageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image for LinkedIn upload: HTTP ${imageRes.status} from ${publicImageUrl}`)
  }

  const imageBuffer = await imageRes.arrayBuffer()
  const contentType = imageRes.headers.get("Content-Type") ?? "image/jpeg"

  // PUT the raw binary to LinkedIn — no Auth header (pre-signed URL)
  const uploadRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: { "Content-Type": contentType },
    body:    imageBuffer,
  })

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn image upload PUT failed: HTTP ${uploadRes.status}`)
  }
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

  const authorUrn   = `urn:li:person:${account.platform_account_id}`
  const accessToken = account.platform_access_token
  const hasImages   = input.mediaUrls.length > 0

  // Build the commentary. If there are multiple images, note extras in the caption.
  let commentary = buildCommentary(input.caption, input.hashtags)
  if (input.mediaUrls.length > 1) {
    commentary = `${commentary}\n\n(+ ${input.mediaUrls.length - 1} more image${input.mediaUrls.length > 2 ? "s" : ""})`
  }

  // ── Image upload (3-step) ─────────────────────────────────────────────────
  let imageUrn: string | null = null

  if (hasImages) {
    try {
      const { uploadUrl, imageUrn: urn } = await initLinkedInImageUpload(authorUrn, accessToken)
      await uploadImageToLinkedIn(input.mediaUrls[0], uploadUrl)
      imageUrn = urn
    } catch (err) {
      // If image upload fails, fall back to text post rather than failing entirely.
      // Log the error so it's visible in Inngest/Vercel logs.
      console.error("[publishToLinkedIn] Image upload failed, falling back to text post:", err)
      commentary = `${commentary}\n\n📎 [Image could not be attached — see post for details]`
      imageUrn = null
    }
  }

  // ── Build post body ───────────────────────────────────────────────────────
  const postBody: Record<string, unknown> = {
    author:    authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution:            "MAIN_FEED",
      targetEntities:              [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState:           "PUBLISHED",
    isReshareDisabledByAuthor: false,
  }

  // Step 3: attach the uploaded image URN to the post
  if (imageUrn) {
    postBody.content = {
      media: { id: imageUrn },
    }
  }

  // ── Post to LinkedIn ──────────────────────────────────────────────────────
  const response = await fetch(`${LINKEDIN_API_BASE}/posts`, {
    method: "POST",
    headers: {
      Authorization:              `Bearer ${accessToken}`,
      "LinkedIn-Version":          LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type":              "application/json",
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

  const postedUrl = `https://www.linkedin.com/feed/update/${postUrn}/`

  return { publishedId: postUrn, postedUrl }
}
