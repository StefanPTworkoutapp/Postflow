/**
 * Publishes a post to Instagram via the Instagram Graph API (Facebook Graph API v21.0).
 *
 * Supported content types:
 *   - Single image     → create IMAGE container → publish
 *   - Single video     → create REELS container → poll until FINISHED → publish
 *   - Carousel         → create child containers per image → create CAROUSEL container → publish
 *   - Text-only        → not supported by Instagram (Meta API restriction); throws an error
 *
 * The two-step flow (create then publish) is required by the Instagram Graph API.
 * Videos (Reels) require polling the container status until FINISHED before publishing —
 * this can take 10–60 seconds depending on video length and resolution.
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

/** Returns true if the URL points to a video file. */
function isVideoUrl(url: string): boolean {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  return ["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)
}

/**
 * Polls the container status every 5 seconds until it's FINISHED or ERROR.
 * Videos can take 10–60 seconds to process; images are usually ready immediately.
 * Throws after 90 seconds (18 polls) to prevent infinite waiting.
 */
async function waitForContainerReady(
  igUserId: string,
  containerId: string,
  accessToken: string
): Promise<void> {
  const MAX_POLLS = 18 // 90 seconds total
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const body = (await res.json()) as { status_code?: string; error?: unknown }
    if (body.status_code === "FINISHED") return
    if (body.status_code === "ERROR") {
      throw new Error("Instagram media container processing failed. Check the video format and try again.")
    }
    // PUBLISHED, IN_PROGRESS, EXPIRED — keep polling
  }
  throw new Error("Instagram video processing timed out after 90 seconds. Try again or use a shorter/smaller video.")
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
    // Instagram error code for MEDIA_NOT_READY — retry once after 3 s
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

  const firstMedia = input.mediaUrls[0]
  const firstIsVideo = isVideoUrl(firstMedia)

  // Resolve the effective post type:
  // - Explicit postType="story" or "reel" always wins
  // - Fall back to detecting from file extension so older posts still work
  const isStory = input.postType === "story"
  const isReel  = input.postType === "reel" || (input.postType !== "story" && firstIsVideo)

  try {
    // --- Story: 24-hour ephemeral Story (photo or video) ---
    if (isStory) {
      if (!firstMedia) {
        throw new Error("Instagram Stories require at least one image or video.")
      }
      const containerParams: Record<string, unknown> = firstIsVideo
        ? { media_type: "STORIES", video_url: firstMedia, access_token: accessToken }
        : { media_type: "STORIES", image_url: firstMedia, access_token: accessToken }
      // Stories do not support captions via the API — Instagram silently ignores them.
      // The caption is stored in PostFlow's DB for reference only.

      const container = await graphPost(`/${igUserId}/media`, containerParams)
      const containerId = String(container.id)

      // Video stories need the same processing poll as Reels
      if (firstIsVideo) {
        await waitForContainerReady(igUserId, containerId, accessToken)
      }

      const publishedId = await publishContainer(igUserId, containerId, accessToken)
      return { publishedId, postedUrl }
    }

    // --- Reel: short-form video published to the Reels tab ---
    if (isReel) {
      const container = await graphPost(`/${igUserId}/media`, {
        media_type: "REELS",
        video_url: firstMedia,
        caption: fullCaption,
        access_token: accessToken,
      })
      const containerId = String(container.id)

      // Reels require processing before publishing (up to 90 s)
      await waitForContainerReady(igUserId, containerId, accessToken)

      const publishedId = await publishContainer(igUserId, containerId, accessToken)
      return { publishedId, postedUrl }
    }

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

    // --- Single image feed post ---
    const container = await graphPost(`/${igUserId}/media`, {
      image_url: firstMedia,
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
