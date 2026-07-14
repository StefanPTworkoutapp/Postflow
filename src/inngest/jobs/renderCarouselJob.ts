/**
 * renderCarouselJob — background carousel render (P4, 2026-07-14).
 *
 * Was a synchronous POST /api/posts/[id]/render-carousel (1 Puppeteer page
 * per slide, maxDuration 120) blocking the HTTP request. The route now only
 * validates + enqueues; this job does the actual render + upload + persist
 * via carouselRenderService.ts, then writes the result back onto
 * post_render_jobs for the UI to pick up via polling.
 *
 * Event: postflow/post.render-carousel.requested
 * Data:  { jobId }
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { runCarouselRenderJob } from "@/lib/server/render/carouselRenderService"
import type { CarouselRenderInput } from "@/lib/server/render/renderPost"

interface CarouselJobInput {
  postId:       string
  brandId:      string
  templateSlug: string
  slideContent: CarouselRenderInput["slideContent"]
}

export const renderCarouselJob = inngest.createFunction(
  {
    id:          "render-carousel",
    name:        "Render Carousel (Puppeteer)",
    triggers:    [{ event: "postflow/post.render-carousel.requested" }],
    concurrency: { limit: 5 },
    retries:     1, // Puppeteer renders are expensive — don't hammer on failure
  },
  async ({ event, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { jobId } = (event as any).data as { jobId: string }
    const supabase = createServiceClient()

    const job = await step.run("load-job", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("post_render_jobs")
        .select("id, post_id, brand_id, input, status")
        .eq("id", jobId)
        .maybeSingle()
      if (error || !data) throw new Error(`render job ${jobId} not found: ${error?.message}`)
      return data as { id: string; post_id: string; brand_id: string; input: CarouselJobInput; status: string }
    })

    if (job.status !== "pending") {
      return { skipped: true, reason: `job already in status '${job.status}'` }
    }

    await step.run("mark-rendering", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("post_render_jobs").update({ status: "rendering" }).eq("id", jobId)
    })

    try {
      const result = await step.run("render-and-upload", async () => {
        return runCarouselRenderJob(supabase, {
          postId:       job.post_id,
          brandId:      job.brand_id,
          templateSlug: job.input.templateSlug,
          slideContent: job.input.slideContent,
        })
      })

      await step.run("mark-done", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("post_render_jobs")
          .update({ status: "done", result, completed_at: new Date().toISOString() })
          .eq("id", jobId)
      })

      return { success: true, jobId, imageUrls: result.imageUrls }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Render failed"
      await step.run("mark-failed", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("post_render_jobs")
          .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
          .eq("id", jobId)
      })
      // Re-throw so Inngest records the failure too (retries: 1 above)
      throw err
    }
  }
)
