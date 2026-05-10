import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractToneProfile } from "@/lib/server/ai/extractToneProfile"

/**
 * POST /api/ai/analyze-tone
 * Sends voice examples to Claude and returns a structured ToneProfile.
 * Also saves the profile to the brand row if brand_id is provided.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { brand_id, examples, brand_name, industry, adjectives, tone_level } =
      await request.json()

    if (!examples || !brand_name || !industry) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const profile = await extractToneProfile(
      examples,
      brand_name,
      industry,
      adjectives ?? [],
      tone_level ?? 5
    )

    // Save to brand row if we have a brand_id
    if (brand_id) {
      await supabase
        .from("brands")
        .update({ tone_profile: profile, tone_examples: [examples] })
        .eq("id", brand_id)
        .eq("account_id", user.id)
    }

    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
