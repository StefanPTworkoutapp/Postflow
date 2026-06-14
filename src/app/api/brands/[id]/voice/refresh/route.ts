/**
 * POST /api/brands/[id]/voice/refresh
 *
 * Re-runs tone extraction from existing tone_examples and merges the result
 * into the current tone_profile (preserving manual edits to do_use / do_not_use).
 *
 * Requires: Starter+ plan (editing requires sign-in with a brand)
 */

import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractToneProfile }  from "@/lib/server/ai/extractToneProfile"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Ownership check
  const { data: brand } = await supabase
    .from("brands")
    .select("id, account_id, name, industry, tone_examples, tone_profile")
    .eq("id", id)
    .single()

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 })

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", user.id)
    .single()

  if (brand.account_id !== account?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const examples = brand.tone_examples as string[] | null
  if (!examples?.length) {
    return NextResponse.json({ error: "No tone examples on file. Add example posts first." }, { status: 400 })
  }

  // Re-run tone extraction
  const existing = (brand.tone_profile as Record<string, unknown> | null) ?? {}
  const existingToneLevel = (existing.tone_level as number | null) ?? 5

  const freshProfile = await extractToneProfile(
    examples.join("\n\n---\n\n"),
    brand.name ?? "Brand",
    brand.industry ?? "General",
    (existing.personality_traits as string[] | null) ?? [],
    existingToneLevel,
    brand.id,
  )

  // Merge: keep manually set do_use/do_not_use/signature_phrases if they exist,
  // otherwise take the fresh values.
  const merged = {
    ...freshProfile,
    // If user has manual entries (set via voice editor), preserve them
    do_use:            (existing._manual_do_use           as string[] | undefined) ?? freshProfile.do_use,
    do_not_use:        (existing._manual_do_not_use       as string[] | undefined) ?? freshProfile.do_not_use,
    signature_phrases: (existing._manual_signature_phrases as string[] | undefined) ?? freshProfile.signature_phrases,
  }

  const service = createServiceClient()

  // Save merged profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await service
    .from("brands")
    .update({
      tone_profile:    merged as unknown as Record<string, string>,
      voice_updated_at: new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("id", id)

  // Log the refresh
  await service.from("brand_token_events").insert({
    brand_id:      id,
    token_key:     "voice_profile",
    signal_type:   "calibration",
    old_value:     null,
    new_value:     JSON.stringify({ source: "manual_refresh", example_count: examples.length }),
    signal_detail: { source: "voice_refresh_endpoint", example_count: examples.length },
  })

  return NextResponse.json({ profile: merged })
}
