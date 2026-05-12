/**
 * Brand Assembler — converts a BrandKit + clip list into a Shotstack render spec.
 *
 * Responsibilities:
 * - Reads brand_kit JSONB from brands table
 * - Maps text_overlay_style token to animation preset
 * - Constructs Shotstack layer order (clips → lower-third → logo → text → hook)
 * - Returns a typed ShotstackRenderSpec ready for submitRender()
 *
 * Layer order (bottom to top):
 *   1. Video clips
 *   2. Lower-third bar (static, brand color shape)
 *   3. Logo watermark (static, full duration)
 *   4. Caption text overlays (dynamic, per section)
 *   5. Hook text or kinetic overlay (dynamic, opening / CTA end)
 *
 * Text overlay style is read from brand intelligence tokens:
 *   text_overlay_style → one of: bold_center | lower_third | minimal_corner | full_screen_moment | kinetic
 */

import type {
  ShotstackRenderSpec,
  ShotstackClip,
  ShotstackTextOverlay,
} from "@/lib/server/render/shotstack"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrandKit {
  color?: {
    primary?:   string
    secondary?: string
    accent?:    string
    text?:      string
  }
  font?: {
    display?: string
    body?:    string
  }
  logo?: {
    url?:       string
    placement?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
    opacity?:   number
    size?:      "small" | "medium" | "large"
  }
}

export interface ClipInput {
  /** Publicly accessible URL for the clip */
  publicUrl:        string
  /** Duration in seconds */
  durationSeconds:  number
  /** Optional hook text for the first clip */
  hookText?:        string
  /** Optional CTA text for the last clip */
  ctaText?:         string
  /** Per-clip caption / educational point */
  captionText?:     string
}

export interface AssembleSpec {
  clips:              ClipInput[]
  platform:           string
  goal:               string
  brandKit:           BrandKit | null
  /** text_overlay_style token value */
  textOverlayStyle?:  string
  /** Optional background music */
  music?: {
    src:    string
    volume: number
  }
}

// ── Platform output specs ─────────────────────────────────────────────────────

function platformToAspectRatio(platform: string): "9:16" | "1:1" | "4:5" | "16:9" {
  switch (platform) {
    case "linkedin":  return "1:1"
    default:          return "9:16"  // instagram, tiktok, facebook, youtube
  }
}

function platformToResolution(platform: string): "hd" | "fhd" {
  return platform === "linkedin" ? "fhd" : "hd"
}

// ── Text overlay position map ─────────────────────────────────────────────────

type OverlayStyle = "bold_center" | "lower_third" | "minimal_corner" | "full_screen_moment" | "kinetic"

function styleToPosition(style: OverlayStyle): ShotstackTextOverlay["position"] {
  const map: Record<OverlayStyle, ShotstackTextOverlay["position"]> = {
    bold_center:        "center",
    lower_third:        "bottom",
    minimal_corner:     "bottomLeft",
    full_screen_moment: "center",
    kinetic:            "center",
  }
  return map[style] ?? "center"
}

function normaliseStyle(raw?: string): OverlayStyle {
  const valid: OverlayStyle[] = ["bold_center", "lower_third", "minimal_corner", "full_screen_moment", "kinetic"]
  return valid.includes(raw as OverlayStyle) ? (raw as OverlayStyle) : "bold_center"
}

// ── Main assembler ────────────────────────────────────────────────────────────

/**
 * Converts brand kit + clip inputs into a fully typed ShotstackRenderSpec.
 * This is the single source of truth for how video renders are assembled.
 */
export function assembleBrandedRender(spec: AssembleSpec): ShotstackRenderSpec {
  const { clips, platform, brandKit, textOverlayStyle, music } = spec
  const style = normaliseStyle(textOverlayStyle)

  // ── Build clip list with timeline offsets ─────────────────────────────────
  let currentTime = 0
  const shotstackClips: ShotstackClip[] = clips.map(clip => {
    const c: ShotstackClip = {
      src:    clip.publicUrl,
      start:  currentTime,
      length: clip.durationSeconds,
    }
    currentTime += clip.durationSeconds
    return c
  })
  const totalDuration = currentTime

  // ── Text overlays ─────────────────────────────────────────────────────────
  const textOverlays: ShotstackTextOverlay[] = []
  const position = styleToPosition(style)

  let timeOffset = 0
  clips.forEach((clip, i) => {
    // Hook text on first clip
    if (i === 0 && clip.hookText) {
      textOverlays.push({
        text:     clip.hookText,
        style,
        start:    0,
        length:   Math.min(clip.durationSeconds, 3),
        position: "center",
      })
    }

    // Per-clip caption / educational point
    if (clip.captionText) {
      textOverlays.push({
        text:     clip.captionText,
        style,
        start:    timeOffset + (i === 0 ? 3 : 0),  // after hook text on first clip
        length:   clip.durationSeconds - (i === 0 ? 3 : 0),
        position,
      })
    }

    // CTA on last clip
    if (i === clips.length - 1 && clip.ctaText) {
      const ctaStart = timeOffset + Math.max(0, clip.durationSeconds - 3)
      textOverlays.push({
        text:     clip.ctaText,
        style,
        start:    ctaStart,
        length:   3,
        position: "center",
      })
    }

    timeOffset += clip.durationSeconds
  })

  // ── Brand overlays ────────────────────────────────────────────────────────
  const primaryColor = brandKit?.color?.primary ?? "#0DA5A5"

  return {
    clips: shotstackClips,
    output: {
      format:     "mp4",
      resolution: platformToResolution(platform),
      aspectRatio: platformToAspectRatio(platform),
    },
    overlays: {
      lowerThird: { color: primaryColor },
      logo: brandKit?.logo?.url ? {
        src:       brandKit.logo.url,
        placement: brandKit.logo.placement ?? "top-right",
        opacity:   brandKit.logo.opacity ?? 0.85,
        size:      brandKit.logo.size ?? "small",
        length:    null,  // full duration
      } : undefined,
      textOverlays: textOverlays.length ? textOverlays : undefined,
    },
    music: music ?? undefined,
  }
}
