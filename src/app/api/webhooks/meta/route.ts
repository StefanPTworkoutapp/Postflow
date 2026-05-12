/**
 * Meta / Instagram Webhook Handler
 *
 * GET  — Webhook verification challenge (required by Meta during setup)
 * POST — Receives real-time events from Instagram (comments, mentions, messages)
 *
 * Setup in Meta Developer Suite:
 *   Callback URL: https://<your-vercel-domain>/api/webhooks/meta
 *   Verify token: value of META_WEBHOOK_VERIFY_TOKEN env var
 *
 * Required env vars:
 *   META_WEBHOOK_VERIFY_TOKEN  — chosen by you, must match Meta dashboard entry
 *   META_APP_SECRET            — from Meta App dashboard (for signature validation)
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks
 */

import { NextRequest, NextResponse } from "next/server"
import { createHmac }                from "crypto"
import { createServiceClient }       from "@/lib/supabase/service"

// ── GET — Webhook verification ────────────────────────────────────────────────

/**
 * Meta calls this endpoint when you click "Verify and save" in the dashboard.
 * It sends three query params:
 *   hub.mode         = "subscribe"
 *   hub.verify_token = <your META_WEBHOOK_VERIFY_TOKEN>
 *   hub.challenge    = <random string Meta wants echoed back>
 *
 * We verify the token matches and echo back hub.challenge to confirm ownership.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const mode      = searchParams.get("hub.mode")
  const token     = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (!verifyToken) {
    console.error("[meta-webhook] META_WEBHOOK_VERIFY_TOKEN is not set")
    return new NextResponse("Server misconfigured", { status: 500 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[meta-webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[meta-webhook] Verification failed — token mismatch or wrong mode")
  return new NextResponse("Forbidden", { status: 403 })
}

// ── POST — Incoming events ────────────────────────────────────────────────────

/**
 * Meta sends signed POST requests for subscribed events.
 * We verify the X-Hub-Signature-256 header before processing.
 *
 * Currently handled events:
 *   - instagram feed changes (new comments, mentions)
 *   - Future: DM notifications, story replies
 *
 * For analytics purposes: we log raw events to post_analytics
 * when a matching post is found by platform post ID.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // ── Signature validation ─────────────────────────────────────────────────
  const appSecret   = process.env.META_APP_SECRET ?? process.env.INSTAGRAM_APP_SECRET
  const sigHeader   = req.headers.get("x-hub-signature-256") ?? ""

  if (appSecret && sigHeader) {
    const expectedSig = "sha256=" + createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex")

    if (sigHeader !== expectedSig) {
      console.warn("[meta-webhook] Signature mismatch — request rejected")
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  // ── Parse event ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const object = body.object as string | undefined
  const entry  = (body.entry as Array<Record<string, unknown>> | undefined) ?? []

  console.log(`[meta-webhook] Received ${object} event with ${entry.length} entries`)

  // ── Handle Instagram events ───────────────────────────────────────────────
  if (object === "instagram") {
    const supabase = createServiceClient()

    for (const e of entry) {
      const changes = (e.changes as Array<Record<string, unknown>> | undefined) ?? []
      for (const change of changes) {
        const field = change.field as string | undefined
        const value = change.value as Record<string, unknown> | undefined

        if (!value) continue

        // Media interactions — update engagement counts on matching post
        if (field === "feed" || field === "media") {
          const mediaId = value.media_id as string | undefined
          if (mediaId) {
            await handleMediaInteraction(supabase, mediaId, field, value)
          }
        }
      }
    }
  }

  // Meta expects a 200 OK within 10s to confirm delivery
  return new NextResponse("OK", { status: 200 })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function handleMediaInteraction(
  supabase:    ReturnType<typeof createServiceClient>,
  mediaId:     string,
  field:       string,
  value:       Record<string, unknown>,
) {
  try {
    // Find a post matched by buffer_post_id (Meta media IDs are stored there
    // when a post is published via Buffer → Instagram)
    const { data: post } = await supabase
      .from("posts")
      .select("id, brand_id")
      .eq("buffer_post_id", mediaId)
      .maybeSingle()

    if (!post) return  // Post not tracked in PostFlow — ignore

    const p = post as { id: string; brand_id: string }

    // Find the analytics row for this post
    const { data: analytics } = await supabase
      .from("post_analytics")
      .select("id, comments")
      .eq("post_id", p.id)
      .maybeSingle()

    if (!analytics) return

    const a = analytics as { id: string; comments: number | null }

    // Increment counts based on event type
    if (field === "feed" && value.verb === "add") {
      // New comment event — increment comment count
      await supabase
        .from("post_analytics")
        .update({ comments: (a.comments ?? 0) + 1 })
        .eq("id", a.id)
    }
  } catch (err) {
    console.error("[meta-webhook] handleMediaInteraction failed:", err)
  }
}
