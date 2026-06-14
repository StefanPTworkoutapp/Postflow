/**
 * Shared types for all PostFlow templates.
 * Every template receives TemplateData and returns an HTML string.
 * Puppeteer renders the HTML at the specified dimensions → PNG.
 */

export interface BrandVars {
  brandName:       string
  logoUrl:         string | null
  primaryColor:    string   // hex e.g. "#6366f1"
  secondaryColor:  string   // hex
  /**
   * Brand accent color — distinct from primary/secondary. Used for highlights,
   * CTA elements, and decorative accents in templates.
   * Set in the brand editor; defaults to secondaryColor when absent.
   */
  accentColor:     string
  fontHeading:     string   // family name, will be matched to system font
  fontBody:        string
  /** 0 = clean/minimal  50 = balanced  100 = bold/expressive. Default: 50 */
  templateStyle:   number
}

export interface TemplateData extends BrandVars {
  // Content
  headline:       string         // primary text / caption excerpt / hook
  subtext?:       string         // secondary text (optional)
  hashtags?:      string[]
  cta?:           string | null

  // For carousel slides
  slideIndex?:    number          // 0-based, undefined = single image
  totalSlides?:   number
  slideContent?:  SlideContent[]

  // Uploaded media URL (background image for photo/reel templates)
  mediaUrl?:      string | null

  // Platform dimensions
  width:          number
  height:         number
}

export interface SlideContent {
  headline:  string
  body?:     string
  isCTA?:    boolean
  isHook?:   boolean
  mediaUrl?: string | null
}

export interface TemplateDefinition {
  slug:        string
  name:        string
  description: string
  type:        "single_image" | "carousel" | "reel_cover" | "story"
  platforms:   string[] | null   // null = all platforms
  buildHtml:   (data: TemplateData) => string
  /** For carousel: how many slides does this template produce for N content items */
  slideCount?: (contentItems: number) => number
}

// ── Utilities shared across all templates ────────────────────────────────────

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + "…"
}

/** Scale a font size relative to card width */
export function fs(width: number, ratio: number): number {
  return Math.round(width * ratio)
}

/** Derive a lighter tint of a hex color (append alpha hex) */
export function tint(hex: string, alpha = "18"): string {
  return `${hex}${alpha}`
}

/** Map brand font name to closest system font stack */
export function fontStack(name: string): string {
  return `'${name}', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`
}

/**
 * Interpolate a value based on templateStyle (0–100).
 * styleInterp(style, 0.8, 1.4) → at style=0 returns 0.8, at style=100 returns 1.4.
 * Use for font-weight multipliers, letter-spacing, border-radius, opacity, etc.
 */
export function styleInterp(style: number, minVal: number, maxVal: number): number {
  return minVal + (maxVal - minVal) * (style / 100)
}

export function logoBlock(d: BrandVars, size: number): string {
  const stack = fontStack(d.fontHeading)
  if (d.logoUrl) {
    return `<img src="${esc(d.logoUrl)}" alt="${esc(d.brandName)}"
      style="width:${size}px;height:${size}px;object-fit:contain;border-radius:6px;" />`
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:6px;
    background:${d.primaryColor};display:flex;align-items:center;justify-content:center;
    color:#fff;font-family:${stack};font-weight:700;font-size:${Math.round(size * 0.5)}px;">
    ${esc(d.brandName[0] ?? "B")}</div>`
}
