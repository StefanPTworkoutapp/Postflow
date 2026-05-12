/**
 * Shotstack API wrapper — video renders for clip-forge and trend-forge.
 *
 * Shotstack handles all video compilation, overlay compositing, and encoding.
 * Puppeteer remains for static card images only.
 *
 * Docs: https://shotstack.io/docs/api/
 * Env: SHOTSTACK_API_KEY (Indie plan or pay-per-render)
 *
 * Key principles:
 * - All renders are submitted async — caller polls status via pollRender()
 * - render_id is stored in clip_forge_jobs.shotstack_render_id for polling
 * - Failed renders are retried up to 2 times before marking the job failed
 */

const SHOTSTACK_BASE = "https://api.shotstack.io/v1"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShotstackClip {
  src:      string  // public URL or signed URL
  start:    number  // seconds from video start
  length:   number  // duration in seconds
}

export interface ShotstackTextOverlay {
  text:     string
  style:    "bold_center" | "lower_third" | "minimal_corner" | "full_screen_moment" | "kinetic"
  start:    number   // when to display
  length:   number   // how long to display
  position?: "top" | "center" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
}

export interface ShotstackLogoOverlay {
  src:       string   // logo public URL
  placement: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  opacity:   number   // 0–1
  size:      "small" | "medium" | "large"
  /** Duration — null = full video duration */
  length?:   number | null
}

export interface ShotstackRenderSpec {
  /** Video clips in order */
  clips:          ShotstackClip[]
  /** Aspect ratio and resolution */
  output: {
    format:     "mp4"
    resolution: "hd" | "fhd"
    aspectRatio: "9:16" | "1:1" | "4:5" | "16:9"
  }
  /** Brand kit overlays */
  overlays?: {
    logo?:       ShotstackLogoOverlay
    lowerThird?: { color: string }   // brand primary color hex
    textOverlays?: ShotstackTextOverlay[]
  }
  /** Background music track URL (10–90s, fades at end) */
  music?: {
    src:    string  // public URL
    volume: number  // 0–1, applied via audio mix
  }
}

export interface ShotstackRenderResult {
  renderId: string
  /** Polling URL — use this to check status */
  url:      string
  status:   "queued" | "fetching" | "rendering" | "saving" | "done" | "failed"
}

export interface ShotstackRenderStatus {
  status:   "queued" | "fetching" | "rendering" | "saving" | "done" | "failed"
  progress: number  // 0–100
  url:      string | null  // output URL when done
  error?:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiKey(): string {
  const key = process.env.SHOTSTACK_API_KEY
  if (!key) throw new Error("SHOTSTACK_API_KEY is not set")
  return key
}

function aspectRatioToDimensions(ar: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    "9:16": { width: 1080, height: 1920 },
    "1:1":  { width: 1080, height: 1080 },
    "4:5":  { width: 1080, height: 1350 },
    "16:9": { width: 1920, height: 1080 },
  }
  return map[ar] ?? { width: 1080, height: 1920 }
}

function textStyleToShotstackEffect(style: ShotstackTextOverlay["style"]): string {
  const map: Record<ShotstackTextOverlay["style"], string> = {
    bold_center:        "fadeIn",
    lower_third:        "slideUpSlow",
    minimal_corner:     "fadeIn",
    full_screen_moment: "zoomIn",
    kinetic:            "bounce",
  }
  return map[style] ?? "fadeIn"
}

function logoSizeToScale(size: "small" | "medium" | "large"): number {
  return { small: 0.12, medium: 0.18, large: 0.25 }[size] ?? 0.15
}

// ── Build Shotstack API payload ───────────────────────────────────────────────

/**
 * Build a Shotstack v1 render payload from our internal spec.
 * Returns the raw JSON object to POST to /render.
 */
export function buildShotstackPayload(spec: ShotstackRenderSpec): Record<string, unknown> {
  const { width, height } = aspectRatioToDimensions(spec.output.aspectRatio)
  const totalDuration = spec.clips.reduce((sum, c) => sum + c.length, 0)

  // ── Video tracks ──────────────────────────────────────────────
  const videoClipTracks = spec.clips.map(clip => ({
    clips: [{
      asset:  { type: "video", src: clip.src },
      start:  clip.start,
      length: clip.length,
    }],
  }))

  // ── Overlay tracks ────────────────────────────────────────────
  const overlayTracks: unknown[] = []

  // Lower-third bar (full duration, brand color)
  if (spec.overlays?.lowerThird) {
    overlayTracks.push({
      clips: [{
        asset: {
          type:   "html",
          html:   `<div style="width:100%;height:80px;background:${spec.overlays.lowerThird.color};opacity:0.9;"></div>`,
          width,
          height: 80,
          position: "bottom",
        },
        start:  0,
        length: totalDuration,
      }],
    })
  }

  // Logo watermark (full duration)
  if (spec.overlays?.logo) {
    const logo = spec.overlays.logo
    overlayTracks.push({
      clips: [{
        asset:    { type: "image", src: logo.src },
        start:    0,
        length:   logo.length ?? totalDuration,
        opacity:  logo.opacity,
        scale:    logoSizeToScale(logo.size),
        position: logo.placement,
      }],
    })
  }

  // Text overlays
  if (spec.overlays?.textOverlays?.length) {
    const textClips = spec.overlays.textOverlays.map(ov => ({
      asset: {
        type:     "title",
        text:     ov.text,
        style:    "future",  // Shotstack built-in style — overridden by our CSS
        size:     "medium",
        position: ov.position ?? "center",
        effect:   textStyleToShotstackEffect(ov.style),
      },
      start:  ov.start,
      length: ov.length,
    }))
    overlayTracks.push({ clips: textClips })
  }

  // ── Audio track ───────────────────────────────────────────────
  const audioTracks: unknown[] = []
  if (spec.music) {
    audioTracks.push({
      clips: [{
        asset:  { type: "audio", src: spec.music.src },
        start:  0,
        length: totalDuration,
        volume: spec.music.volume ?? 0.4,
        effect: "fadeOutSlow",
      }],
    })
  }

  return {
    timeline: {
      soundtrack: audioTracks[0] ?? undefined,
      tracks: [
        ...videoClipTracks,
        ...overlayTracks,
      ],
    },
    output: {
      format:     "mp4",
      resolution: spec.output.resolution ?? "hd",
      aspectRatio: spec.output.aspectRatio,
      size:        { width, height },
    },
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Submit a render job to Shotstack.
 * Returns the render ID for status polling.
 */
export async function submitRender(spec: ShotstackRenderSpec): Promise<ShotstackRenderResult> {
  const payload = buildShotstackPayload(spec)

  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    apiKey(),
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Shotstack render submit failed (${res.status}): ${text}`)
  }

  const json = await res.json() as {
    success: boolean
    message: string
    response: { id: string; message: string; status: string }
  }

  if (!json.success) throw new Error(`Shotstack error: ${json.message}`)

  return {
    renderId: json.response.id,
    url:      `${SHOTSTACK_BASE}/render/${json.response.id}`,
    status:   "queued",
  }
}

/**
 * Poll render status.
 * Call this every 5–10 seconds until status is "done" or "failed".
 */
export async function pollRender(renderId: string): Promise<ShotstackRenderStatus> {
  const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
    headers: { "x-api-key": apiKey() },
  })

  if (!res.ok) {
    throw new Error(`Shotstack poll failed (${res.status})`)
  }

  const json = await res.json() as {
    success: boolean
    data: {
      attributes: {
        status:   string
        progress: number
        url:      string | null
        error?:   string
      }
    }
  }

  const attrs = json.data?.attributes
  return {
    status:   (attrs?.status ?? "queued") as ShotstackRenderStatus["status"],
    progress: attrs?.progress ?? 0,
    url:      attrs?.url ?? null,
    error:    attrs?.error,
  }
}
