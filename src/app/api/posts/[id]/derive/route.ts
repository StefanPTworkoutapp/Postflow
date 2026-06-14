/**
 * POST /api/posts/[id]/derive
 *
 * Creates a new derived post from an existing one.
 *
 * Use cases:
 *   - Turn a feed post image into an Instagram Story
 *   - Turn a post into a Reel (user provides a video, or the rendered image is used for
 *     a static reel — note: Instagram requires actual video for Reels via the API;
 *     a static image posted as a Reel will be rejected. This endpoint creates a Draft
 *     the user can attach a video to before scheduling.)
 *   - Re-share a high-performing post as a new Story draft (automated by the
 *     evergreen-repurpose Inngest job)
 *
 * Body:
 *   { targetType: "story" | "reel" | "feed_post", platform?: string }
 *
 * Returns the new post ID so the caller can open the editor or schedule directly.
 */

import { NextResponse }         from "next/server"
import { createClient }          from "@/lib/supabase/server"
import { createServiceClient }  from "@/lib/supabase/service"

interface DeriveBody {
  targetType: "story" | "reel" | "feed_post"
  platform?: string          // defaults to same platform as source post
  scheduleImmediately?: boolean  // if true, schedule as Story right now
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourcePostId } = await params

  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: DeriveBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { targetType, platform: targetPlatform, scheduleImmediately } = body

  if (!["story", "reel", "feed_post"].includes(targetType)) {
    return NextResponse.json(
      { error: "targetType must be 'story', 'reel', or 'feed_post'" },
      { status: 400 }
    )
  }

  // ── Load source post + verify ownership ───────────────────────────────────
  const db = createServiceClient()

  const { data: source, error: sourceErr } = await db
    .from("posts")
    .select(`
      id, brand_id, platform, caption, hashtags,
      media_ids, carousel_image_urls, template_slug, post_type,
      brands!inner(user_id)
    `)
    .eq("id", sourcePostId)
    .single()

  if (sourceErr || !source) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  const brandOwner = (source.brands as unknown as { user_id: string } | null)?.user_id
  if (brandOwner !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── Determine media for the derived post ──────────────────────────────────
  // Use first carousel image or first media_id image as the visual source
  const carouselUrls = (source.carousel_image_urls as string[] | null) ?? []
  const firstImageUrl = carouselUrls[0] ?? null
  // For the derived post, use the same media references as the source
  const derivedMediaIds = (source.media_ids as string[] | null) ?? []

  // ── Determine template slug for new type ──────────────────────────────────
  const derivedTemplateSlug =
    targetType === "story"    ? "story-teaser"
    : targetType === "reel"   ? "reel-cover"
    : (source.template_slug ?? "photo-overlay")

  const derivedPlatform = targetPlatform ?? source.platform

  // ── Caption adjustment for post type ─────────────────────────────────────
  // Stories: keep it very short — trim to first sentence
  // Reels:   caption stays, user can edit before scheduling
  let derivedCaption = (source.caption ?? "").trim()
  if (targetType === "story") {
    // First sentence only — stories are visual, not text-heavy
    const firstSentence = derivedCaption.split(/[.!?]/)[0]?.trim()
    derivedCaption = firstSentence
      ? `${firstSentence}.`
      : derivedCaption.slice(0, 80)
  }

  // ── Create the derived post as a draft ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newPost, error: insertErr } = await (db.from("posts") as any)
    .insert({
      brand_id:            source.brand_id,
      platform:            derivedPlatform,
      post_type:           targetType === "feed_post" ? "single_image" : targetType,
      template_slug:       derivedTemplateSlug,
      caption:             derivedCaption,
      hashtags:            targetType === "story" ? [] : (source.hashtags ?? []),
      media_ids:           derivedMediaIds,
      carousel_image_urls: firstImageUrl ? [firstImageUrl] : [],
      status:              "draft",
      source_post_id:      sourcePostId,  // lineage — col added in migration 20260616000004
    })
    .select("id")
    .single()

  if (insertErr || !newPost) {
    console.error("[derive] Insert failed:", insertErr)
    return NextResponse.json({ error: "Failed to create derived post" }, { status: 500 })
  }

  // ── Optionally schedule the story immediately ─────────────────────────────
  // Stories are time-sensitive (24h lifespan) — if requested, fire the Inngest job now
  if (scheduleImmediately && targetType === "story") {
    const scheduledAt = new Date(Date.now() + 60_000).toISOString() // 1 min from now

    await db
      .from("posts")
      .update({ status: "scheduled", scheduled_for: scheduledAt })
      .eq("id", newPost.id)

    // Dynamic import to avoid circular deps at module level
    const { inngest } = await import("@/inngest/client")
    await inngest.send({
      name: "postflow/post.scheduled",
      data: {
        postId:      newPost.id,
        brandId:     source.brand_id,
        platform:    derivedPlatform,
        scheduledAt,
      },
    })
  }

  return NextResponse.json({
    postId:      newPost.id,
    targetType,
    platform:    derivedPlatform,
    status:      scheduleImmediately && targetType === "story" ? "scheduled" : "draft",
    editorUrl:   `/posts/${newPost.id}`,
  })
}
