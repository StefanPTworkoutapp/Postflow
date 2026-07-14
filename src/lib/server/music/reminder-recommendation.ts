/**
 * Reminder-mode song recommendation.
 *
 * Reminder publish mode (posts.publish_mode = 'reminder') never touches an
 * audio file — the client adds music themselves inside the platform's own
 * app. All PostFlow does is recommend a track NAME + vibe so the client knows
 * what to search for. This reuses the exact scoring logic in
 * music-selector.ts (kept intact through P0) rather than duplicating it.
 *
 * This is plain scoring over a static library — no AI/LLM call, so there is
 * nothing to background here.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { selectMusicTracks }   from "./music-selector"

export interface ReminderMusicRecommendation {
  trackName: string
  /** Human-readable description shown in the reminder email, e.g. "high energy · modern electronic" */
  vibe:      string
}

function humanize(s: string): string {
  return s.replace(/_/g, " ")
}

/**
 * Picks the single best-matching track for the brand + platform and returns
 * it as display metadata only (no URL, no audio reference).
 */
export async function getReminderMusicRecommendation(
  brandId:  string,
  platform: string,
): Promise<ReminderMusicRecommendation> {
  const supabase = createServiceClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("intelligence_tokens")
    .eq("id", brandId)
    .maybeSingle()

  const tokens = ((brand as { intelligence_tokens?: unknown } | null)?.intelligence_tokens ?? {}) as Record<
    string,
    { value?: string } | undefined
  >

  const musicEnergy = tokens.music_energy?.value ?? "medium_high"
  const musicGenre  = tokens.music_genre?.value  ?? "modern_electronic"

  const [top] = selectMusicTracks(musicEnergy, musicGenre, platform)

  // Extremely defensive — TRACK_LIBRARY is a non-empty static array, but
  // never let a missing recommendation crash the schedule/reminder flow.
  if (!top) {
    return { trackName: "Upbeat background track", vibe: "medium energy · general" }
  }

  const genre = top.genres[0] ? humanize(top.genres[0]) : "general"
  return {
    trackName: top.title,
    vibe:      `${humanize(top.energy)} energy · ${genre}`,
  }
}
