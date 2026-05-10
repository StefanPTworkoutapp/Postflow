import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { checkPostLimit } from "@/lib/server/billing/limits"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    // ── Plan limit check ──────────────────────────────────────────────────────
    const limitCheck = await checkPostLimit(brand.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason, upgradeHint: limitCheck.upgradeHint, code: "LIMIT_EXCEEDED" },
        { status: 402 }
      )
    }

    const body = await request.json()
    const {
      platform,
      template_id,
      caption,
      hashtags,
      cta,
      ai_caption_original,
      scheduled_date,
      topic,
      content_pillar,
      media_ids,
    } = body

    if (!platform || !caption) {
      return NextResponse.json({ error: "platform and caption are required" }, { status: 400 })
    }

    // Auto-create a calendar entry for this post
    const { data: calEntry, error: calError } = await supabase
      .from("content_calendar")
      .insert({
        brand_id: brand.id,
        scheduled_date: scheduled_date ?? new Date().toISOString().split("T")[0],
        platforms: [platform],
        topic: topic ?? null,
        content_pillar: content_pillar ?? null,
        status: "drafting",
      })
      .select()
      .single()

    if (calError) return NextResponse.json({ error: calError.message }, { status: 400 })

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        brand_id: brand.id,
        calendar_entry_id: calEntry.id,
        platform,
        // template_id is a UUID FK — code-defined slugs (e.g. "behind-scenes") can't be
        // stored here until we create a templates DB table. Omit for now.
        caption,
        hashtags:            hashtags  ?? [],
        cta:                 cta       ?? null,
        ai_caption_original: ai_caption_original ?? caption,
        media_ids:           media_ids ?? [],
        status: "draft",
      })
      .select()
      .single()

    if (postError) return NextResponse.json({ error: postError.message }, { status: 400 })

    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ posts: [] })

    const { data: posts, error } = await supabase
      .from("posts")
      .select("*, content_calendar(scheduled_date, topic, content_pillar)")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
