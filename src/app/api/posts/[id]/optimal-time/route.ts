/**
 * GET /api/posts/[id]/optimal-time
 *
 * Returns the optimal posting time for a specific post based on:
 *   1. Brand + platform performance_patterns (if >= 5 posts of data)
 *   2. Platform-specific industry benchmarks (fallback)
 *
 * Response:
 *   {
 *     suggestedAt: string,     // ISO datetime of next optimal occurrence
 *     label: string,           // "Tuesday at 18:00"
 *     confidence: "data" | "fallback"
 *     platform: string
 *   }
 */

import { NextResponse }              from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"
import { getOptimalScheduleTime, nextOccurrence, formatOptimalTime } from "@/lib/server/scheduling/optimal-time"

/** Platform-specific default hours when no data is available */
const PLATFORM_DEFAULTS: Record<string, { dayOfWeek: number; hour: number }> = {
  instagram: { dayOfWeek: 3, hour: 18 }, // Wednesday 18:00 — peak IG engagement
  linkedin:  { dayOfWeek: 2, hour: 9  }, // Tuesday 09:00 — business hours peak
  facebook:  { dayOfWeek: 3, hour: 13 }, // Wednesday 13:00 — FB lunch peak
  tiktok:    { dayOfWeek: 5, hour: 19 }, // Friday 19:00 — TikTok evening peak
  x:         { dayOfWeek: 2, hour: 9  }, // Tuesday 09:00
  threads:   { dayOfWeek: 3, hour: 18 }, // Wednesday 18:00
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: postId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No active brand" }, { status: 400 })

    // Load post to get platform + post_type
    const { data: post } = await supabase
      .from("posts")
      .select("platform, post_type")
      .eq("id", postId)
      .eq("brand_id", brand.id)
      .single()

    const platform = post?.platform  ?? "instagram"
    const postType = post?.post_type ?? "single_image"

    // Post-type specific default times when there's no analytics data yet.
    // Reels and Stories have different peak times than feed posts on the same platform.
    const POST_TYPE_DEFAULTS: Record<string, Record<string, { dayOfWeek: number; hour: number }>> = {
      reel:    { instagram: { dayOfWeek: 5, hour: 20 }, tiktok:    { dayOfWeek: 5, hour: 19 } },
      story:   { instagram: { dayOfWeek: 1, hour: 9  } },  // Monday morning — start of week
      carousel:{ instagram: { dayOfWeek: 2, hour: 12 }, linkedin: { dayOfWeek: 3, hour: 11 } },
    }

    // Try analytics-based optimal time first
    const optimal = await getOptimalScheduleTime(brand.id, platform)

    // If fallback, apply post-type-aware defaults (more specific than platform-only)
    if (optimal.confidence === "fallback") {
      const typeDefault = POST_TYPE_DEFAULTS[postType]?.[platform]
      const platformDefault = PLATFORM_DEFAULTS[platform] ?? { dayOfWeek: 2, hour: 18 }
      const def = typeDefault ?? platformDefault
      optimal.dayOfWeek = def.dayOfWeek
      optimal.hour      = def.hour
    }

    const suggestedAt = nextOccurrence(optimal)
    const label       = formatOptimalTime(optimal)

    return NextResponse.json({
      suggestedAt,
      label,
      confidence: optimal.confidence,
      platform,
      postType,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
