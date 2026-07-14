import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { inngest } from "@/inngest/client"

// post_render_jobs is not yet in generated database.types.ts pre-migration —
// same type-bypass idiom as dailyAnalyticsFetch.ts's `newTables()` helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: Awaited<ReturnType<typeof createClient>>) => client as any

/**
 * POST /api/posts/[id]/render-variants
 *
 * P4 (2026-07-14): converted to a background job — 3 sequential Puppeteer
 * renders are too slow to hold an HTTP request open for. This route now
 * only validates + enqueues; the actual render + upload happens in
 * src/inngest/jobs/renderVariantsJob.ts.
 *
 * Body (optional): { templateSlugs?: string[] }  — override the 3 templates to try.
 * If omitted, the job picks the best 3 single-image templates for the platform.
 *
 * Returns (202): { jobId: string } — poll GET /api/render-jobs/[jobId] for status/result
 * Result shape once done: { variants: Array<{ templateSlug: string; templateName: string; imageUrl: string }> }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  let requestedSlugs: string[] | undefined
  try {
    const body = await req.json()
    requestedSlugs = Array.isArray(body?.templateSlugs) ? body.templateSlugs : undefined
  } catch { /* no body */ }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Confirm the post exists + belongs to this brand
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  const { data: job, error: jobErr } = await nt(supabase)
    .from("post_render_jobs")
    .insert({
      brand_id: brand.id,
      post_id:  postId,
      job_type: "variants",
      status:   "pending",
      input:    { templateSlugs: requestedSlugs ?? null },
    })
    .select("id")
    .single()

  if (jobErr || !job) {
    console.error("[render-variants] failed to enqueue job:", jobErr?.message)
    return NextResponse.json({ error: jobErr?.message ?? "Failed to enqueue render job" }, { status: 500 })
  }

  try {
    await inngest.send({
      name: "postflow/post.render-variants.requested",
      data: { jobId: job.id },
    })
  } catch (sendErr) {
    // Fail soft: mark the job row failed rather than stranding a forever-
    // "pending" orphan when the Inngest event API is unreachable.
    const msg = sendErr instanceof Error ? sendErr.message : "unknown error"
    console.error("[postflow/post.render-variants.requested] inngest.send failed:", msg)
    await nt(supabase)
      .from("post_render_jobs")
      .update({ status: "failed", error: `Could not start the render job (${msg})`, completed_at: new Date().toISOString() })
      .eq("id", job.id)
    return NextResponse.json(
      { error: "Could not start the render job — please try again in a moment." },
      { status: 503 },
    )
  }

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
