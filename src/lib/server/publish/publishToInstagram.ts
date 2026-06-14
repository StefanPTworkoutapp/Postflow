/**
 * Publishes a post to Instagram via the Instagram Graph API (Facebook Graph API v21.0).
 *
 * Supported content types:
 *   - Single image     → create media container → publish
 *   - Carousel         → create child containers → create carousel container → publish
 *   - Text-only        → not supported by Instagram; throws an error
 *
 * The two-step flow (create then publish) is required by the Instagram Graph API.
 * For video content, the container status must be FINISHED before publishing —
 * this publisher retries once after 3 seconds if the first publish attempt returns
 * MEDIA_NOT_READY. (Images are usually ready immediately.)
 *
 * API reference:
 *   https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * Auth: Facebook long-lived user token stored in postflow.social_accounts.platform_access_token.
 * The IG Business Account ID is in platform_account_id.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { PublishInput, PublishResult } from "./types"

const GRAPH_BASE = "https://graph.facebook.com/v21.0"

/** Wraps a Graph API error body into a human-readable string. */
function graphErrorMessage(body: Record<string, unknown>, status: number): string {
  const err = body?.error as Record<string, unknown> | undefined
  return err?.message ? String(err.message) : `HTTP ${status}`
}

/** POST helper for Graph API endpoints. Returns the parsed JSON body. */
async function graphPost(
  endpoint: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })

  const body = (await response.json()) as Record<string, unknown>

  if (!response.ok || body.error) {
    throw { status: response.status, body }
  }

  return body
}

/** Attempts to publish a prepared container ID; retries once after 3 s on MEDIA_NOT_READY. */
async function publishContainer(
  igUserId: string,
  creationId: string,
  accessToken: string
): Promise<string> {
  const attempt = async (): Promise<string> => {
    const body = await graphPost(`/${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: accessToken,
    })
    return String(body.id)
  }

  try {
    return await attempt()
  } catch (err: unknown) {
    const apiErr = err as { status: number; body: Record<string, unknown> }
    const errCode = (apiErr?.body?.error as Record<string, unknown> | undefined)?.code
    // Instagram error code for MEDIA_NOT_READY
    if (errCode === 9007) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      return await attempt()
    }
    throw err
  }
}

export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const db = createServiceClient()

  const { data: account, error: accountError } = await db
    .from("social_accounts")
    .select("platform_access_token, platform_account_id, account_handle")
    .eq("brand_id", input.brandId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .single()

  if (accountError || !account) {
    throw new Error(
      "Instagram account not connected for this brand. Please reconnect your Instagram account in Settings."
    )
  }

  if (!account.platform_access_token) {
    throw new Error(
      "Instagram access token is missing. Please reconnect your Instagram account in Settings."
    )
  }

  if (!account.platform_account_id) {
    throw new Error(
      "Instagram Business Account ID is missing. Please reconnect your Instagram account in Settings."
    )
  }

  if (input.mediaUrls.length === 0) {
    throw new Error(
      "Instagram requires at least one image or video. Text-only posts are not supported on Instagram."
    )
  }

  const igUserId = account.platform_account_id
  const accessToken = account.platform_access_token
  const fullCaption = input.hashtags.length
    ? `${input.caption}\n\n${input.hashtags.map((h) => `#${h}`).join(" ")}`
    : input.caption

  // Fallback profile URL — Instagram Graph API does not return a direct post permalink.
  const handle = account.account_handle
  const postedUrl = handle
    ? `https://www.instagram.com/${handle}/`
    : `https://www.instagram.com/`

  try {
    // --- Carousel: 2+ images and isCarousel requested ---
    if (input.isCarousel && input.mediaUrls.length >= 2) {
      // Step 1: create a child container for each image
      const childIds: string[] = []
      for (const imageUrl of input.mediaUrls) {
        const child = await graphPost(`/${igUserId}/media`, {
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: accessToken,
        })
        childIds.push(String(child.id))
      }

      // Step 2: create the carousel container
      const carousel = await graphPost(`/${igUserId}/media`, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: fullCaption,
        access_token: accessToken,
      })
      const carouselId = String(carousel.id)

      // Step 3: publish the carousel
      const publishedId = await publishContainer(igUserId, carouselId, accessToken)
      return { publishedId, postedUrl }
    }

    // --- Single image (or multiple images but not carousel-flagged — post first) ---
    const container = await graphPost(`/${igUserId}/media`, {
      image_url: input.mediaUrls[0],
      caption: fullCaption,
      access_token: accessToken,
    })
    const containerId = String(container.id)

    const publishedId = await publishContainer(igUserId, containerId, accessToken)
    return { publishedId, postedUrl }
  } catch (err: unknown) {
    const apiErr = err as { status: number; body: Record<string, unknown> }
    if (apiErr?.status && apiErr?.body) {
      const detail = graphErrorMessage(apiErr.body, apiErr.status)
      console.error("[publishToInstagram] API error:", detail)
      throw new Error(`Instagram post failed: ${detail}`)
    }
    throw err
  }
}
