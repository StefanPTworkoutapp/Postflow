import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

// ── PATCH /api/posts/[id] ────────────────────────────────────────────────────
// Body: { caption?, hashtags?, cta?, status?, scheduled_date?, topic?, media_ids?, generated_image_url? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await request.json() as {
      caption?:              string
      hashtags?:             string[]
      cta?:                  string
      status?:               string
      scheduled_date?:       string
      topic?:                string
      media_ids?:            string[]
      generated_image_url?:  string | null
    }

    // Build typed posts update
    const { data, error } = await supabase
      .from("posts")
      .update({
        ...(body.caption              !== undefined && { caption:             body.caption }),
        ...(body.hashtags             !== undefined && { hashtags:            body.hashtags }),
        ...(body.cta                  !== undefined && { cta:                 body.cta }),
        ...(body.status               !== undefined && { status:              body.status }),
        ...(body.media_ids            !== undefined && { media_ids:           body.media_ids }),
        ...(body.generated_image_url  !== undefined && { generated_image_url: body.generated_image_url }),
      })
      .eq("id", id)
      .eq("brand_id", brand.id)
      .select("*, content_calendar(id, scheduled_date, topic)")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const post = data

    // Sync the linked calendar entry (date, topic, and status mirror)
    const POST_TO_CAL_STATUS: Record<string, string> = {
      draft:     "drafting",
      planned:   "planned",
      ready:     "ready",
      scheduled: "scheduled",
      posted:    "posted",
    }
    const calStatus = body.status ? POST_TO_CAL_STATUS[body.status] : undefined

    if (body.scheduled_date !== undefined || body.topic !== undefined || calStatus !== undefined) {
      const cal = post.content_calendar as { id?: string } | null
      if (cal?.id) {
        await supabase
          .from("content_calendar")
          .update({
            ...(body.scheduled_date !== undefined && { scheduled_date: body.scheduled_date }),
            ...(body.topic          !== undefined && { topic:          body.topic }),
            ...(calStatus           !== undefined && { status:         calStatus }),
          })
          .eq("id", cal.id)
      }
    }

    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── DELETE /api/posts/[id] ───────────────────────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    // Fetch the post to get its calendar_entry_id
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("calendar_entry_id")
      .eq("id", id)
      .eq("brand_id", brand.id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })

    // Delete post
    const { error: delError } = await supabase
      .from("posts")
      .delete()
      .eq("id", id)
      .eq("brand_id", brand.id)

    if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

    // If this was the only post using that calendar entry, delete the entry too
    if (post.calendar_entry_id) {
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("calendar_entry_id", post.calendar_entry_id)

      if ((count ?? 0) === 0) {
        await supabase
          .from("content_calendar")
          .delete()
          .eq("id", post.calendar_entry_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
