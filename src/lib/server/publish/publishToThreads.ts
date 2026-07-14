/**
 * Publishes a post to Threads via the Threads Graph API (graph.threads.net).
 *
 * Supported content types:
 *   - Text-only          → create TEXT container → publish
 *   - Single image        → create IMAGE container (image_url) → publish
 *   - Single video         → create VIDEO container (video_url) → poll until FINISHED → publish
 *   - Carousel (2+ items)  → create child containers (is_carousel_item) → CAROUSEL container → publish
 *
 * The two-step flow (create container, then publish) mirrors Instagram's Graph API —
 * see publishToInstagram.ts for the sibling implementation and the container-polling
 * pattern this file reuses for video processing.
 *
 * API reference:
 *   https://developers.facebook.com/docs/threads/posts
 *   https://developers.facebook.com/docs/threads/troubleshooting#status-codes
 *
 * Auth: Threads long-lived user access token stored in
 * postflow.social_accounts.platform_access_token. The Threads user ID is in
 * platform_account_id. Long-lived tokens are valid for 60 days and are
 * refreshed here in-line when fewer than 7 days remain (see refreshTokenIfNeeded).
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { PublishInput, PublishResult } from "./types"

const THREADS_API_BASE = "https://graph.threads.net/v1.0"
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // refresh when <7 days of validity remain

/** Wraps a Threads Graph API error body into a human-readable string. */
function threadsErrorMessage(body: Record<string, unknown>, status: number): string {
  const err = body?.error as Record<string, unknown> | undefined
  return err?.message ? String(err.message) : `HTTP ${status}`
}

/** POST helper for Threads Graph API endpoints. Returns the parsed JSON body. */
async function threadsPost(
  endpoint: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(`${THREADS_API_BASE}${endpoint}`)
  const response = await fetch(url.toString(), {
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
 * Polls a Threads media container's status every 5 seconds until it's FINISHED
 * or ERROR. Videos can take a while to process; images are usually near-instant.
 * Throws after 90 seconds (18 polls) to avoid waiting forever.
 */
async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  const MAX_POLLS = 18 // 90 seconds total
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const res = await fetch(
      `${THREADS_API_BASE}/${containerId}?fields=status,error_message&access_token=${accessToken}`
    )
    const body = (await res.json()) as { status?: string; error_message?: string }
    if (body.status === "FINISHED") return
    if (body.status === "ERROR") {
      throw new Error(
        `Threads media container processing failed${body.error_message ? `: ${body.error_message}` : "."}`
      )
    }
    // EXPIRED, IN_PROGRESS, PUBLISHED — keep polling (PUBLISHED is a transient state before FINISHED)
  }
  throw new Error("Threads video processing timed out after 90 seconds. Try again or use a shorter/smaller video.")
}

/**
 * Refreshes the stored long-lived Threads token if fewer than 7 days of
 * validity remain, and persists the refreshed token + new expiry to
 * social_accounts. Threads long-lived tokens are refreshable via
 * grant_type=th_refresh_token once they are at least 24h old, and refreshing
 * extends validity by another ~60 days.
 *
 * Fails soft: if the refresh call fails, the existing (possibly soon-to-expire)
 * token is returned so publishing can still be attempted — the platform itself
 * will reject an actually-expired token with a clear auth error.
 */
async function refreshTokenIfNeeded(
  accountId: string,
  accessToken: string,
  tokenExpiresAt: string | null
): Promise<string> {
  if (!tokenExpiresAt) return accessToken

  const expiresAtMs = new Date(tokenExpiresAt).getTime()
  if (Number.isNaN(expiresAtMs) || expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
    return accessToken
  }

  try {
    const url = new URL("https://graph.threads.net/refresh_access_token")
    url.searchParams.set("grant_type", "th_refresh_token")
    url.searchParams.set("access_token", accessToken)

    const res = await fetch(url.toString())
    if (!res.ok) {
      console.error("[publishToThreads] Token refresh failed:", res.status, await res.text())
      return accessToken
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return accessToken

    const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 5_184_000) * 1000).toISOString()

    const db = createServiceClient()
    await db
      .from("social_accounts")
      .update({ platform_access_token: data.access_token, token_expires_at: newExpiresAt })
      .eq("id", accountId)

    return data.access_token
  } catch (err) {
    console.error("[publishToThreads] Unexpected error refreshing token:", err)
    return accessToken
  }
}

export async function publishToThreads(input: PublishInput): Promise<PublishResult> {
  const db = createServiceClient()

  const { data: account, error: accountError } = await db
    .from("social_accounts")
    .select("id, platform_access_token, platform_account_id, account_handle, token_expires_at")
    .eq("brand_id", input.brandId)
    .eq("platform", "threads")
    .eq("is_active", true)
    .single()

  if (accountError || !account) {
    throw new Error(
      "Threads account not connected for this brand. Please reconnect your Threads account in Settings."
    )
  }

  if (!account.platform_access_token) {
    throw new Error(
      "Threads access token is missing. Please reconnect your Threads account in Settings."
    )
  }

  if (!account.platform_account_id) {
    throw new Error(
      "Threads user ID is missing. Please reconnect your Threads account in Settings."
    )
  }

  const threadsUserId = account.platform_account_id
  const accessToken = await refreshTokenIfNeeded(
    account.id,
    account.platform_access_token,
    account.token_expires_at
  )

  const fullText = input.hashtags.length
    ? `${input.caption}\n\n${input.hashtags.map((h) => `#${h}`).join(" ")}`
    : input.caption

  const handle = account.account_handle
  const postedUrlBase = handle ? `https://www.threads.net/@${handle}` : "https://www.threads.net/"

  const hasMedia = input.mediaUrls.length > 0
  const firstMedia = input.mediaUrls[0]
  const firstIsVideo = hasMedia && isVideoUrl(firstMedia)

  try {
    // --- Carousel: 2+ items ---
    if (input.isCarousel && input.mediaUrls.length >= 2) {
      const childIds: string[] = []
      for (const mediaUrl of input.mediaUrls) {
        const isVid = isVideoUrl(mediaUrl)
        const child = await threadsPost(`/${threadsUserId}/threads`, isVid
          ? { media_type: "VIDEO", video_url: mediaUrl, is_carousel_item: true, access_token: accessToken }
          : { media_type: "IMAGE", image_url: mediaUrl, is_carousel_item: true, access_token: accessToken }
        )
        const childId = String(child.id)
        if (isVid) {
          await waitForContainerReady(childId, accessToken)
        }
        childIds.push(childId)
      }

      const carousel = await threadsPost(`/${threadsUserId}/threads`, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        text: fullText,
        access_token: accessToken,
      })
      const carouselId = String(carousel.id)

      const published = await threadsPost(`/${threadsUserId}/threads_publish`, {
        creation_id: carouselId,
        access_token: accessToken,
      })
      const publishedId = String(published.id)
      return { publishedId, postedUrl: postedUrlBase }
    }

    // --- Single video ---
    if (firstIsVideo) {
      const container = await threadsPost(`/${threadsUserId}/threads`, {
        media_type: "VIDEO",
        video_url: firstMedia,
        text: fullText,
        access_token: accessToken,
      })
      const containerId = String(container.id)

      // Videos require processing before publishing (up to 90 s)
      await waitForContainerReady(containerId, accessToken)

      const published = await threadsPost(`/${threadsUserId}/threads_publish`, {
        creation_id: containerId,
        access_token: accessToken,
      })
      const publishedId = String(published.id)
      return { publishedId, postedUrl: postedUrlBase }
    }

    // --- Single image ---
    if (hasMedia) {
      const container = await threadsPost(`/${threadsUserId}/threads`, {
        media_type: "IMAGE",
        image_url: firstMedia,
        text: fullText,
        access_token: accessToken,
      })
      const containerId = String(container.id)

      const published = await threadsPost(`/${threadsUserId}/threads_publish`, {
        creation_id: containerId,
        access_token: accessToken,
      })
      const publishedId = String(published.id)
      return { publishedId, postedUrl: postedUrlBase }
    }

    // --- Text-only ---
    const container = await threadsPost(`/${threadsUserId}/threads`, {
      media_type: "TEXT",
      text: fullText,
      access_token: accessToken,
    })
    const containerId = String(container.id)

    const published = await threadsPost(`/${threadsUserId}/threads_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    })
    const publishedId = String(published.id)
    return { publishedId, postedUrl: postedUrlBase }
  } catch (err: unknown) {
    const apiErr = err as { status: number; body: Record<string, unknown> }
    if (apiErr?.status && apiErr?.body) {
      const detail = threadsErrorMessage(apiErr.body, apiErr.status)
      console.error("[publishToThreads] API error:", detail)
      throw new Error(`Threads post failed: ${detail}`)
    }
    throw err
  }
}
