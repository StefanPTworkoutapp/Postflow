/**
 * Music Selector — selects 3 background music tracks based on brand tokens.
 *
 * The 3 tracks are offered to the user in MusicPicker with 10s preview clips.
 * Track selection is based on:
 *   - music_energy token (low/medium/medium_high/high)
 *   - music_genre token
 *   - Platform (TikTok favours trending, LinkedIn favours subtle)
 *
 * Tracks are sourced from PostFlow's curated royalty-free library.
 * All tracks are stored in Supabase storage (postflow-renders bucket, public).
 *
 * In MVP: uses a static curated library of 12 tracks.
 * Future: Shotstack has a built-in music library — can fetch from there.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id:          string
  title:       string
  artist:      string
  energy:      "low" | "medium" | "medium_high" | "high"
  genres:      string[]
  /** 10s preview URL */
  preview_url: string
  /** Full track URL for Shotstack */
  full_url:    string
  duration:    number  // seconds
  platforms:   string[]  // best-fit platforms
  bpm:         number
}

// ── Curated track library ─────────────────────────────────────────────────────

/**
 * PostFlow curated track library.
 * All tracks are royalty-free and cleared for commercial use.
 * Stored in postflow-renders/music/ bucket.
 *
 * Note: preview_url and full_url point to the public bucket.
 * Replace paths once actual tracks are uploaded to storage.
 */
const TRACK_LIBRARY: MusicTrack[] = [
  {
    id:          "track-001",
    title:       "Morning Energy",
    artist:      "PostFlow Music",
    energy:      "medium_high",
    genres:      ["modern_electronic", "pop"],
    preview_url: "/tracks/previews/morning-energy-10s.mp3",
    full_url:    "/tracks/full/morning-energy.mp3",
    duration:    120,
    platforms:   ["instagram", "tiktok", "youtube"],
    bpm:         128,
  },
  {
    id:          "track-002",
    title:       "Calm Focus",
    artist:      "PostFlow Music",
    energy:      "low",
    genres:      ["ambient", "cinematic"],
    preview_url: "/tracks/previews/calm-focus-10s.mp3",
    full_url:    "/tracks/full/calm-focus.mp3",
    duration:    90,
    platforms:   ["linkedin", "instagram", "facebook"],
    bpm:         75,
  },
  {
    id:          "track-003",
    title:       "Build Up",
    artist:      "PostFlow Music",
    energy:      "high",
    genres:      ["modern_electronic", "hip_hop"],
    preview_url: "/tracks/previews/build-up-10s.mp3",
    full_url:    "/tracks/full/build-up.mp3",
    duration:    90,
    platforms:   ["instagram", "tiktok"],
    bpm:         140,
  },
  {
    id:          "track-004",
    title:       "Steady Groove",
    artist:      "PostFlow Music",
    energy:      "medium",
    genres:      ["pop", "r&b"],
    preview_url: "/tracks/previews/steady-groove-10s.mp3",
    full_url:    "/tracks/full/steady-groove.mp3",
    duration:    120,
    platforms:   ["instagram", "facebook", "tiktok"],
    bpm:         100,
  },
  {
    id:          "track-005",
    title:       "Corporate Motion",
    artist:      "PostFlow Music",
    energy:      "medium",
    genres:      ["cinematic", "corporate"],
    preview_url: "/tracks/previews/corporate-motion-10s.mp3",
    full_url:    "/tracks/full/corporate-motion.mp3",
    duration:    120,
    platforms:   ["linkedin", "facebook"],
    bpm:         95,
  },
  {
    id:          "track-006",
    title:       "Pulse",
    artist:      "PostFlow Music",
    energy:      "high",
    genres:      ["modern_electronic"],
    preview_url: "/tracks/previews/pulse-10s.mp3",
    full_url:    "/tracks/full/pulse.mp3",
    duration:    90,
    platforms:   ["instagram", "tiktok", "youtube"],
    bpm:         145,
  },
  {
    id:          "track-007",
    title:       "Soft Journey",
    artist:      "PostFlow Music",
    energy:      "low",
    genres:      ["acoustic", "cinematic"],
    preview_url: "/tracks/previews/soft-journey-10s.mp3",
    full_url:    "/tracks/full/soft-journey.mp3",
    duration:    120,
    platforms:   ["instagram", "linkedin", "facebook"],
    bpm:         68,
  },
  {
    id:          "track-008",
    title:       "Tropical Drive",
    artist:      "PostFlow Music",
    energy:      "medium_high",
    genres:      ["pop", "tropical"],
    preview_url: "/tracks/previews/tropical-drive-10s.mp3",
    full_url:    "/tracks/full/tropical-drive.mp3",
    duration:    90,
    platforms:   ["instagram", "tiktok"],
    bpm:         118,
  },
]

// ── Energy match scoring ──────────────────────────────────────────────────────

const ENERGY_LEVELS: Record<string, number> = {
  low:          1,
  medium:       2,
  medium_high:  3,
  high:         4,
}

function energyDelta(tokenEnergy: string, trackEnergy: string): number {
  const a = ENERGY_LEVELS[tokenEnergy] ?? 2
  const b = ENERGY_LEVELS[trackEnergy] ?? 2
  return Math.abs(a - b)
}

// ── Asset resolution guard ────────────────────────────────────────────────────
//
// The curated track library above still points at /tracks/*.mp3 paths that
// were never uploaded (see file header). If a render spec includes a track
// whose asset doesn't actually resolve, Shotstack fails trying to fetch it.
// resolveTrackUrl() lets callers verify a track before wiring it into a
// render — fail-soft callers should render WITHOUT music rather than fail
// the whole render over a missing audio file.

import fs   from "node:fs"
import path from "node:path"

/**
 * Returns `url` unchanged if it resolves to a real asset, otherwise `null`.
 *
 * - Absolute http(s) URLs (real storage/CDN, once tracks are uploaded there)
 *   are trusted as-is — we don't make a network round-trip here.
 * - Relative paths (the current placeholder library, e.g. "/tracks/full/x.mp3")
 *   are checked against the `public/` directory, since Next.js serves that
 *   directory's contents verbatim at the site root.
 */
export function resolveTrackUrl(url: string | null | undefined): string | null {
  if (!url) return null

  if (/^https?:\/\//i.test(url)) return url

  const relative = url.startsWith("/") ? url.slice(1) : url
  const fullPath = path.join(process.cwd(), "public", relative)
  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return url
  } catch {
    // fall through to null
  }
  return null
}

// ── Main selector ─────────────────────────────────────────────────────────────

/**
 * Select 3 music tracks that best match the brand's token profile.
 *
 * @param musicEnergyToken  Brand token: music_energy value
 * @param musicGenreToken   Brand token: music_genre value
 * @param platform          Target platform
 */
export function selectMusicTracks(
  musicEnergyToken: string = "medium_high",
  musicGenreToken:  string = "modern_electronic",
  platform:         string = "instagram",
): MusicTrack[] {
  // Score each track
  const scored = TRACK_LIBRARY.map(track => {
    let score = 0

    // Energy match (closer = higher score)
    const ed = energyDelta(musicEnergyToken, track.energy)
    score += (4 - ed) * 30  // 0pt gap = 120, 1pt = 90, 2pt = 60, 3pt = 30

    // Genre match
    if (track.genres.includes(musicGenreToken)) score += 40

    // Platform match
    if (track.platforms.includes(platform)) score += 30

    return { track, score }
  })

  // Sort by score and return top 3 (deduplicated by energy to offer variety)
  const sorted = scored.sort((a, b) => b.score - a.score)

  const selected: MusicTrack[] = []
  const usedEnergies = new Set<string>()

  for (const { track } of sorted) {
    if (selected.length >= 3) break
    // Try to offer at least 2 different energy levels for variety
    if (usedEnergies.size < 2 || !usedEnergies.has(track.energy)) {
      selected.push(track)
      usedEnergies.add(track.energy)
    }
  }

  // If we don't have 3 yet, fill from remainder
  if (selected.length < 3) {
    for (const { track } of sorted) {
      if (selected.length >= 3) break
      if (!selected.find(t => t.id === track.id)) {
        selected.push(track)
      }
    }
  }

  return selected.slice(0, 3)
}
