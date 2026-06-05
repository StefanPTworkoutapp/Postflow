/**
 * POST /api/brand/calibrate
 *
 * Seeds initial brand intelligence tokens from the Brand Calibration wizard.
 *
 * Body:
 *   {
 *     answers: {
 *       style:     "Educational" | "Entertaining" | "Inspirational"
 *       formality: number (1–10)
 *       length:    "Short" | "Medium" | "Long"
 *       emojis:    "Never" | "Sometimes" | "Often"
 *       cta:       "Book a session" | "Visit website" | "Follow for more" | "DM me"
 *     }
 *   }
 *
 * Maps each answer to brand tokens and calls seedCalibrationTokens() so every
 * token gets confidence 0.60 and calibration_locked = true.
 *
 * Returns: { success: true, tokens_seeded: string[] }
 */

import { NextResponse }                from "next/server"
import { createClient }                from "@/lib/supabase/server"
import { seedCalibrationTokens }       from "@/lib/server/brand/nudge-token"

// ─── Answer → token mappings ──────────────────────────────────────────────────

const STYLE_MAP: Record<string, string> = {
  Educational:   "educational",
  Entertaining:  "entertaining",
  Inspirational: "inspirational",
}

const LENGTH_MAP: Record<string, string> = {
  Short:  "short",
  Medium: "medium",
  Long:   "long",
}

const EMOJI_MAP: Record<string, string> = {
  Never:     "none",
  Sometimes: "moderate",
  Often:     "heavy",
}

const CTA_MAP: Record<string, string> = {
  "Book a session": "book_session",
  "Visit website":  "visit_website",
  "Follow for more": "follow",
  "DM me":          "dm",
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as {
      answers?: {
        style?:     string
        formality?: number
        length?:    string
        emojis?:    string
        cta?:       string
      }
    }

    const answers = body?.answers
    if (!answers) {
      return NextResponse.json({ error: "Missing answers" }, { status: 400 })
    }

    // Resolve brand for this account
    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("account_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 })
    }

    // Build seed array from answers
    const seeds: Array<{ key: string; value: string | number }> = []

    if (answers.style && STYLE_MAP[answers.style]) {
      seeds.push({ key: "voice_tone", value: STYLE_MAP[answers.style] })
    }

    if (typeof answers.formality === "number" && answers.formality >= 1 && answers.formality <= 10) {
      seeds.push({ key: "voice_energy", value: answers.formality })
    }

    if (answers.length && LENGTH_MAP[answers.length]) {
      seeds.push({ key: "content_format", value: LENGTH_MAP[answers.length] })
    }

    if (answers.emojis && EMOJI_MAP[answers.emojis]) {
      seeds.push({ key: "emoji_usage", value: EMOJI_MAP[answers.emojis] })
    }

    if (answers.cta && CTA_MAP[answers.cta]) {
      seeds.push({ key: "primary_goal", value: CTA_MAP[answers.cta] })
    }

    if (seeds.length === 0) {
      return NextResponse.json({ error: "No valid answers provided" }, { status: 400 })
    }

    await seedCalibrationTokens(brand.id, seeds)

    const tokenKeys = seeds.map(s => s.key)
    return NextResponse.json({ success: true, tokens_seeded: tokenKeys })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("POST /api/brand/calibrate:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
