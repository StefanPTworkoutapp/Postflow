import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * POST /api/calendar/[id]/create-post
 *
 * Creates a post record linked to the given calendar entry and returns its ID
 * so the client can navigate to /posts/[postId]. Also bumps the calendar entry
 * status from "planned" → "drafting".
 *
 * If a post already exists for this entry, returns the first one without
 * creating a duplicate.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: entryId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Load the calendar entry — include slide_content + template_slug so they copy to the post
  const { data: entry, error: entryErr } = await supabase
    .from("content_calendar")
    .select("id, brand_id, topic, content_pillar, goal, platforms, post_type, scheduled_date, posts(id)")
    .eq("id", entryId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  const { data: entryExtras } = await supabase
    .from("content_calendar")
    .select("slide_content, template_slug")
    .eq("id", entryId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 400 })
  if (!entry)   return NextResponse.json({ error: "Entry not found" },  { status: 404 })

  // If a post already exists, return it
  const existingPost = (entry.posts as Array<{ id: string }> | null)?.[0]
  if (existingPost) {
    return NextResponse.json({ postId: existingPost.id, created: false })
  }

  // Pick the first platform from the entry (fall back to "instagram")
  const platform = (entry.platforms as string[] | null)?.[0] ?? "instagram"

  // Create the post — copy slide_content + template_slug from calendar entry
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .insert({
      brand_id:          brand.id,
      calendar_entry_id: entry.id,
      platform,
      caption:           null,
      hashtags:          [],
      status:            "draft",
      template_slug:     entryExtras?.template_slug     ?? null,
      slide_content:     entryExtras?.slide_content     ?? null,
    })
    .select("id")
    .single()

  if (postErr) {
    console.error("[calendar/create-post] insert error:", postErr.message)
    return NextResponse.json({ error: postErr.message }, { status: 500 })
  }

  // Bump the calendar entry status to "drafting"
  await supabase
    .from("content_calendar")
    .update({ status: "drafting" })
    .eq("id", entryId)
    .eq("brand_id", brand.id)

  return NextResponse.json({ postId: post.id, created: true })
}
