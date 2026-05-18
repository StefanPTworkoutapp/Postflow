import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateSamplePost } from "@/lib/server/ai/generateSamplePost"
import type { ToneProfile } from "@/lib/server/ai/extractToneProfile"

/**
 * POST /api/ai/sample-post
 * Generates a sample post using the brand's tone profile.
 * Accepts optional previousFeedback to regenerate with adjustments.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const {
      brand_name,
      industry,
      audience,
      tone_profile,
      examples,
      do_not_mention,
      previous_feedback,
      goals,
      brand_id,
    }: {
      brand_name: string
      industry: string
      audience: string
      tone_profile: ToneProfile
      examples: string
      do_not_mention?: string
      previous_feedback?: string
      goals?: string[]
      brand_id?: string | null
    } = await request.json()

    const result = await generateSamplePost(
      brand_name,
      industry,
      audience,
      tone_profile,
      examples,
      do_not_mention,
      previous_feedback,
      goals,
      brand_id,
    )

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
