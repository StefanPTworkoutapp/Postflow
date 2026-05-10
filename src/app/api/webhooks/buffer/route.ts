import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createHmac } from "crypto"

/**
 * POST /api/webhooks/buffer
 *
 * Receives Buffer webhook events and updates post + calendar entry status.
 *
 * Events handled:
 *   - sent_update:success → post status = "posted", calendar = "posted"
 *   - sent_update:failed  → post status = "failed"
 *
 * Setup in Buffer dashboard:
 *   Callback URL: https://your-domain.com/api/webhooks/buffer
 *   Secret: store in env BUFFER_WEBHOOK_SECRET
 *
 * Docs: https://buffer.com/developers/api/webhooks
 */
export async function POST(request: Request) {
  const body      = await request.text()
  const signature = request.headers.get("x-buffer-signature") ?? ""
  const secret    = process.env.BUFFER_WEBHOOK_SECRET

  // Verify HMAC signature if secret is configured
  if (secret) {
    const expected = createHmac("sha256", secret).update(body).digest("hex")
    if (signature !== `sha256=${expected}`) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let payload: { event?: string; update?: { id?: string; sent_at?: string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event    = payload.event ?? ""
  const bufferId = payload.update?.id

  if (!bufferId) return NextResponse.json({ ok: true })  // unknown shape — ignore

  const supabase = createServiceClient()

  if (event === "sent_update:success") {
    // Find the post by buffer_post_id
    const { data: post } = await supabase
      .from("posts")
      .select("id, calendar_entry_id")
      .eq("buffer_post_id", bufferId)
      .maybeSingle()

    if (post) {
      await supabase
        .from("posts")
        .update({
          status:    "posted",
          posted_at: payload.update?.sent_at ?? new Date().toISOString(),
        })
        .eq("id", post.id)

      if (post.calendar_entry_id) {
        await supabase
          .from("content_calendar")
          .update({ status: "posted" })
          .eq("id", post.calendar_entry_id)
      }
    }
  } else if (event === "sent_update:failed") {
    await supabase
      .from("posts")
      .update({ status: "failed" })
      .eq("buffer_post_id", bufferId)
  }

  return NextResponse.json({ ok: true })
}
