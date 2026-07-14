import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import type { CarouselRenderInput } from "@/lib/server/render/renderPost"
import { assertCarouselValid } from "@/lib/server/render/validate-carousel"
import { inngest } from "@/inngest/client"

// post_render_jobs is not yet in generated database.types.ts pre-migration —
// same type-bypass idiom as dailyAnalyticsFetch.ts's `newTables()` helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: Awaited<ReturnType<typeof createClient>>) => client as any

/**
 * POST /api/posts/[id]/render-carousel
 *
 * P4 (2026-07-14): converted to a background job — 1 Puppeteer page per
 * slide is too slow to hold an HTTP request open for. This route now only
 * validates the request (cheap, synchronous — bad input still fails fast
 * with a 400) and enqueues an Inngest job. The actual render + upload +
 * persist happens in src/inngest/jobs/renderCarouselJob.ts.
 *
 * Body:
 *   {
 *     templateSlug: string,
 *     slideContent: Array<{ headline: string, body?: string, isCTA?: boolean, isHook?: boolean, mediaUrl?: string | null }>
 *   }
 *
 * Returns (202):
 *   { jobId: string }  — poll GET /api/render-jobs/[jobId] for status/result
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // ── 1. Parse + validate body ─────────────────────────────────────────────────
  let templateSlug: string
  let slideContent: CarouselRenderInput["slideContent"]

  try {
    const body = await req.json()
    templateSlug = body.templateSlug
    slideContent = body.slideContent
    if (!templateSlug) throw new Error("templateSlug required")
    if (!Array.isArray(slideContent) || slideContent.length === 0) {
      throw new Error("slideContent array required")
    }
    assertCarouselValid(slideContent, templateSlug)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid request body"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // ── 2. Confirm the post exists + belongs to this brand ───────────────────────
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 })
  if (!post)   return NextResponse.json({ error: "Post not found" }, { status: 404 })

  // ── 3. Enqueue the render job ────────────────────────────────────────────────
  const { data: job, error: jobErr } = await nt(supabase)
    .from("post_render_jobs")
    .insert({
      brand_id: brand.id,
      post_id:  postId,
      job_type: "carousel",
      status:   "pending",
      input:    { templateSlug, slideContent },
    })
    .select("id")
    .single()

  if (jobErr || !job) {
    console.error("[render-carousel] failed to enqueue job:", jobErr?.message)
    return NextResponse.json({ error: jobErr?.message ?? "Failed to enqueue render job" }, { status: 500 })
  }

  await inngest.send({
    name: "postflow/post.render-carousel.requested",
    data: { jobId: job.id },
  })

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
