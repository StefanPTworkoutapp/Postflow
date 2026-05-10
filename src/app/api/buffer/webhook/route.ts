import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/buffer/webhook
 * Buffer calls this when a post is sent (or fails).
 * Payload: { update: { id, status: "sent" | "failed", profile_id, ... } }
 *
 * Buffer does not sign webhook bodies, so we rely on the obscure URL path
 * (BUFFER_WEBHOOK_SECRET embedded in the path) for basic security.
 * Register: https://buffer.com/developers/apps → Webhooks → add URL:
 *   https://your-domain.com/api/buffer/webhook?secret=<BUFFER_WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  try {
    // Optional secret check — Buffer sends no signature header
    const url    = new URL(request.url)
    const secret = url.searchParams.get("secret")
    if (process.env.BUFFER_WEBHOOK_SECRET && secret !== process.env.BUFFER_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json() as {
      update?: {
        id:          string
        status:      string   // "sent" | "failed"
        profile_id:  string
        sent_at?:    string
        error_code?: string
        error_message?: string
      }
    }

    const update = body.update
    if (!update?.id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()

    // Find the post by buffer_post_id
    const { data: post } = await supabase
      .from("posts")
      .select("id, status")
      .eq("buffer_post_id", update.id)
      .single()

    if (!post) {
      // Unknown update — probably from a different app sharing the Buffer account
      return NextResponse.json({ ok: true, message: "Post not found — ignored" })
    }

    if (update.status === "sent") {
      await supabase
        .from("posts")
        .update({
          status:    "posted",
          posted_at: update.sent_at ?? new Date().toISOString(),
        })
        .eq("id", post.id)

      // Sync calendar entry
      await supabase
        .from("content_calendar")
        .update({ status: "posted" })
        .eq("id",
          // resolve calendar_entry_id via the post row
          (await supabase
            .from("posts")
            .select("calendar_entry_id")
            .eq("id", post.id)
            .single()
          ).data?.calendar_entry_id ?? ""
        )

      console.log(`[buffer-webhook] post ${post.id} → posted`)
    } else if (update.status === "failed") {
      await supabase
        .from("posts")
        .update({ status: "failed" })
        .eq("id", post.id)

      console.error(`[buffer-webhook] post ${post.id} → failed: ${update.error_message ?? update.error_code}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[buffer-webhook] error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
