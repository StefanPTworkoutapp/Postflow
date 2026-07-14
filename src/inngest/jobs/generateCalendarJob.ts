/**
 * generateCalendarJob — background monthly calendar generation (P4, 2026-07-14).
 *
 * Was a synchronous POST /api/calendar/generate blocking the HTTP request on
 * one large Claude call (a whole month, up to 4096 output tokens — can take
 * 20-60s). The route now only validates + enqueues; this job does the
 * actual generation via generateCalendarService.ts, then writes the result
 * back onto calendar_generation_jobs for the UI to pick up via polling.
 *
 * Event: postflow/calendar.generate.requested
 * Data:  { jobId }
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { generateCalendarForBrand } from "@/lib/server/calendar/generateCalendarService"
import type { GenerateCalendarInput } from "@/lib/server/calendar/generateCalendarService"

export const generateCalendarJob = inngest.createFunction(
  {
    id:          "generate-calendar",
    name:        "Generate Monthly Calendar (Claude)",
    triggers:    [{ event: "postflow/calendar.generate.requested" }],
    concurrency: { limit: 5 },
    retries:     1,
  },
  async ({ event, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { jobId } = (event as any).data as { jobId: string }
    const supabase = createServiceClient()

    const job = await step.run("load-job", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("calendar_generation_jobs")
        .select("id, brand_id, input, status")
        .eq("id", jobId)
        .maybeSingle()
      if (error || !data) throw new Error(`calendar generation job ${jobId} not found: ${error?.message}`)
      return data as { id: string; brand_id: string; input: GenerateCalendarInput; status: string }
    })

    if (job.status !== "pending") {
      return { skipped: true, reason: `job already in status '${job.status}'` }
    }

    await step.run("mark-running", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("calendar_generation_jobs").update({ status: "running" }).eq("id", jobId)
    })

    const brand = await step.run("load-brand", async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, ai_tier, account_id")
        .eq("id", job.brand_id)
        .maybeSingle()
      if (error || !data) throw new Error(`brand ${job.brand_id} not found`)
      return data as { id: string; ai_tier?: string | null; account_id: string }
    })

    try {
      const result = await step.run("generate-and-insert", async () => {
        return generateCalendarForBrand(supabase, brand, job.input)
      })

      await step.run("mark-done", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("calendar_generation_jobs")
          .update({ status: "done", result, completed_at: new Date().toISOString() })
          .eq("id", jobId)
      })

      return { success: true, jobId, count: result.count }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Calendar generation failed"
      await step.run("mark-failed", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("calendar_generation_jobs")
          .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
          .eq("id", jobId)
      })
      throw err
    }
  }
)
