/**
 * POST /api/inspiration/analyse
 *
 * Accepts a public Instagram or TikTok URL, fetches post structure via Supadata,
 * runs Claude signal extraction, generates a plain-language explanation, and
 * persists the analysis to postflow.inspiration_posts.
 *
 * Body:   { url: string }
 * Returns: { analysisId: string, analysis: PostAnalysis, explanation: string }
 *
 * Error codes:
 *   400  invalid_url | unsupported_platform | private_account | post_deleted
 *   422  analysis_failed (Supadata fetch or Claude parse error)
 *   500  unexpected
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { getBrandContext }           from "@/lib/server/brand/getBrandContext"
import { validateInspirationUrl }    from "@/lib/server/inspiration/url-validator"
import { analyseInspirationPost, InspirationFetchError } from "@/lib/server/inspiration/analyse-post"
import { generateInspirationExplanation } from "@/lib/server/inspiration/explanation-generator"
import { createServiceClient }       from "@/lib/supabase/service"
import { checkAiBudget }             from "@/lib/server/billing/aiBudget"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (x: unknown) => x as any

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    // ── AI budget gate (P5) ─────────────────────────────────────────────────────
    // Inspiration Analyze is non-essential background-style AI work. Once the
    // brand's account is 2x over its monthly cap, block it until month end —
    // captions/calendar stay available (they only degrade to economy models).
    // See src/lib/server/billing/aiBudget.ts.
    {
      const service = createServiceClient()
      const { data: account } = await service
        .from("accounts")
        .select("subscription_tier")
        .eq("id", (brand as { account_id: string }).account_id)
        .maybeSingle()

      const budget = await checkAiBudget(
        (brand as { account_id: string }).account_id,
        account?.subscription_tier ?? "free",
      )

      if (budget.verdict === "blocked") {
        return NextResponse.json({
          error:  "AI budget for this month reached. Inspiration Analyze is paused until next month — captions and calendar generation still work in economy mode.",
          reason: "ai_budget_exceeded",
        }, { status: 429 })
      }
    }

    // ── Body ────────────────────────────────────────────────────────────────────
    let body: { url?: string }
    try {
      body = await req.json() as { url?: string }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const rawUrl = body.url?.trim() ?? ""
    if (!rawUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }

    // ── URL validation ──────────────────────────────────────────────────────────
    const validation = validateInspirationUrl(rawUrl)
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.message, reason: validation.reason },
        { status: 400 }
      )
    }

    const { platform, url } = validation

    // ── Brand context ───────────────────────────────────────────────────────────
    const brandCtx = await getBrandContext(brand.id)
    if (!brandCtx) {
      return NextResponse.json({ error: "Brand context unavailable" }, { status: 400 })
    }

    // ── Analysis pipeline ───────────────────────────────────────────────────────
    let analysis
    try {
      analysis = await analyseInspirationPost(url, platform, brandCtx)
    } catch (err) {
      if (err instanceof InspirationFetchError) {
        const statusMap: Record<string, number> = {
          private_account: 400,
          post_deleted:    400,
          scrape_failed:   422,
        }
        const messageMap: Record<string, string> = {
          private_account: "This post is from a private account.",
          post_deleted:    "We couldn't find this post.",
          scrape_failed:   "Analysis failed. Please try again.",
        }
        return NextResponse.json(
          { error: messageMap[err.reason] ?? "Analysis failed.", reason: err.reason },
          { status: statusMap[err.reason] ?? 422 }
        )
      }
      console.error("[inspiration/analyse] pipeline error:", err)
      return NextResponse.json(
        { error: "Analysis failed. Please try again.", reason: "analysis_failed" },
        { status: 422 }
      )
    }

    // ── Explanation ─────────────────────────────────────────────────────────────
    const explanation = await generateInspirationExplanation(analysis.signals, brandCtx)

    // ── Persist to DB ───────────────────────────────────────────────────────────
    const service = createServiceClient()
    const { data: row, error: insertError } = await nt(service)
      .from("inspiration_posts")
      .insert({
        brand_id:    brand.id,
        source_url:  url,
        platform,
        analysis:    analysis as unknown as Record<string, unknown>,
        signals:     analysis.signals,
        explanation,
        applied:     false,
      })
      .select("id")
      .single()

    if (insertError || !row) {
      console.error("[inspiration/analyse] DB insert error:", insertError?.message)
      // Still return the analysis — don't block on DB write
      return NextResponse.json({
        analysisId:  null,
        analysis,
        explanation,
      })
    }

    return NextResponse.json({
      analysisId:  (row as { id: string }).id,
      analysis,
      explanation,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("[inspiration/analyse] unexpected error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
