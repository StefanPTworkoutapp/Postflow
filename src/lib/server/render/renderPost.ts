/**
 * Puppeteer-based post card renderer.
 * Works locally (system Chrome) and on Vercel (Sparticuz chromium-min).
 *
 * Usage:
 *   - Single image / reel cover / story:
 *       renderPostCard({ ...input, templateSlug: "edu-bold" })
 *
 *   - Carousel (all slides):
 *       renderCarousel({ ...input, templateSlug: "carousel-edu", slideContent: [...] })
 *       → returns ordered Buffer[] (one PNG per slide)
 *
 *   - Legacy (no template slug supplied):
 *       Falls back to the original card.template.ts output.
 */

import puppeteer from "puppeteer-core"
import { buildCardHtml, type CardData } from "./card.template"
import { getTemplate, type TemplateData } from "./templates/index"

/**
 * Fetches an image URL and returns it as a base64 data URI.
 * Puppeteer cannot load external URLs as CSS background-images in --no-sandbox
 * mode. Embedding as data URI guarantees the image renders correctly.
 * Returns null if the fetch fails — templates fall back to brand gradient.
 */
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const buffer = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buffer.toString("base64")}`
  } catch {
    return null
  }
}

// ── Platform dimensions ───────────────────────────────────────────────────────

/** Platform → [width, height] in pixels */
const PLATFORM_DIMS: Record<string, [number, number]> = {
  instagram: [1080, 1350],
  facebook:  [1200, 630],
  linkedin:  [1200, 627],
  tiktok:    [1080, 1920],
  x:         [1200, 675],
  threads:   [1080, 1080],
}

/** Platform dims for vertical formats (reel/story) */
const VERTICAL_DIMS: Record<string, [number, number]> = {
  instagram: [1080, 1920],
  tiktok:    [1080, 1920],
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface RenderInput {
  platform:       string
  caption:        string
  hashtags:       string[]
  cta:            string | null
  brandName:      string
  logoUrl:        string | null
  primaryColor:   string
  secondaryColor: string
  fontHeading:    string
  fontBody:       string
  /** Template slug from postflow.templates. If omitted, uses legacy card renderer. */
  templateSlug?:  string
  /** For photo/reel/story templates: background image URL */
  mediaUrl?:      string | null
  /** Visual intensity 0–100. Default 50. */
  templateStyle?: number
}

export interface CarouselRenderInput extends RenderInput {
  templateSlug:   string    // required for carousel
  slideContent:   Array<{
    headline:  string
    body?:     string
    isCTA?:    boolean
    isHook?:   boolean
    mediaUrl?: string | null
  }>
}

// ── Single image render ───────────────────────────────────────────────────────

/** Returns a single PNG Buffer */
export async function renderPostCard(input: RenderInput): Promise<Buffer> {
  const template = input.templateSlug ? getTemplate(input.templateSlug) : null

  // Derive dimensions: vertical templates get reel/story dims
  const isVertical  = template && (template.type === "reel_cover" || template.type === "story")
  const dimTable    = isVertical ? VERTICAL_DIMS : PLATFORM_DIMS
  const [width, height] = dimTable[input.platform] ?? [1080, 1080]

  // Convert external photo URL → base64 data URI so Puppeteer can render it
  const resolvedMedia = input.mediaUrl ? await toDataUri(input.mediaUrl) : null
  const resolvedInput = { ...input, mediaUrl: resolvedMedia ?? input.mediaUrl }

  let html: string

  if (template) {
    const data = buildTemplateData(resolvedInput, width, height)
    html = template.buildHtml(data)
  } else {
    // Legacy fallback
    const cardData: CardData = { ...resolvedInput, width, height }
    html = buildCardHtml(cardData)
  }

  return renderHtmlToPng(html, width, height)
}

// ── Carousel render ───────────────────────────────────────────────────────────

/**
 * Renders every slide of a carousel template.
 * Returns an ordered array of PNG Buffers (slide 0 first).
 */
export async function renderCarousel(input: CarouselRenderInput): Promise<Buffer[]> {
  const template = getTemplate(input.templateSlug)

  if (template.type !== "carousel") {
    throw new Error(`Template "${input.templateSlug}" is not a carousel template`)
  }

  const [width, height] = PLATFORM_DIMS[input.platform] ?? [1080, 1080]

  // Resolve per-slide media URLs to data URIs upfront (avoid N concurrent fetches)
  const resolvedSlides = await Promise.all(
    input.slideContent.map(async (slide) => {
      if (!slide.mediaUrl) return slide
      const dataUri = await toDataUri(slide.mediaUrl)
      return { ...slide, mediaUrl: dataUri ?? slide.mediaUrl }
    })
  )
  const resolvedInput = { ...input, slideContent: resolvedSlides }

  // Compute total slide count
  const contentItems = resolvedInput.slideContent.length
  const totalSlides  = template.slideCount
    ? template.slideCount(contentItems)
    : contentItems

  // Render slides in parallel (Puppeteer instances are independent)
  const slidePromises = Array.from({ length: totalSlides }, (_, idx) => {
    const data = buildTemplateData(resolvedInput, width, height, {
      slideIndex:   idx,
      totalSlides,
      slideContent: input.slideContent,
    })
    const html = template.buildHtml(data)
    return renderHtmlToPng(html, width, height)
  })

  return Promise.all(slidePromises)
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTemplateData(
  input: RenderInput,
  width: number,
  height: number,
  carouselOverrides?: {
    slideIndex:   number
    totalSlides:  number
    slideContent: TemplateData["slideContent"]
  }
): TemplateData {
  // The card is a visual TEASER — never dump the full caption on it.
  // Headline = first non-empty line, truncated to ~100 chars (one punchy sentence).
  // Subtext  = second non-empty paragraph only, truncated to ~120 chars.
  // Everything else belongs in the Instagram/LinkedIn caption below the image.
  const lines    = input.caption.split("\n").filter(Boolean)
  const headline = (lines[0] ?? input.brandName).slice(0, 120)
  // Use the second distinct paragraph as subtext (skip if it looks like a list item or empty)
  const subtextRaw = lines.slice(1).find(l => l.trim().length > 10 && !l.trim().match(/^\d+\./)) ?? ""
  const subtext    = subtextRaw.slice(0, 130) || undefined

  return {
    // BrandVars
    brandName:      input.brandName,
    logoUrl:        input.logoUrl ?? null,
    primaryColor:   input.primaryColor,
    secondaryColor: input.secondaryColor,
    fontHeading:    input.fontHeading,
    fontBody:       input.fontBody,
    templateStyle:  input.templateStyle ?? 50,
    // Content
    headline,
    subtext,
    hashtags:       input.hashtags,
    cta:            input.cta ?? undefined,
    mediaUrl:       input.mediaUrl ?? null,
    // Dimensions
    width,
    height,
    // Carousel overrides (only set when rendering carousel slides)
    ...(carouselOverrides ?? {}),
  }
}

/** Shared Puppeteer render: HTML string → PNG Buffer */
async function renderHtmlToPng(html: string, width: number, height: number): Promise<Buffer> {
  const executablePath = await getChromiumPath()

  const browser = await puppeteer.launch({
    executablePath,
    args:    chromiumArgs(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    // domcontentloaded — no external assets (system font stacks only)
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 })
    const screenshot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } })
    return Buffer.from(screenshot)
  } finally {
    await browser.close()
  }
}

/**
 * Render multiple HTML strings to PNGs using ONE shared browser instance.
 * All items must share the same dimensions (same platform / template type).
 * Much cheaper than launching N browsers in parallel.
 */
export async function renderHtmlsToPngs(
  items: Array<{ html: string; width: number; height: number }>
): Promise<Buffer[]> {
  if (items.length === 0) return []

  const executablePath = await getChromiumPath()
  const browser = await puppeteer.launch({
    executablePath,
    args:    chromiumArgs(),
    headless: true,
  })

  try {
    // Render sequentially within the shared browser to avoid memory spikes
    const results: Buffer[] = []
    for (const { html, width, height } of items) {
      const page = await browser.newPage()
      try {
        await page.setViewport({ width, height, deviceScaleFactor: 1 })
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 })
        const screenshot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } })
        results.push(Buffer.from(screenshot))
      } finally {
        await page.close()
      }
    }
    return results
  } finally {
    await browser.close()
  }
}

/**
 * Render N variants (different template slugs) for the same post content
 * using a SINGLE shared browser — one Chrome launch instead of N.
 * Returns PNGs in the same order as `inputs`.
 */
export async function renderMultiplePostCards(
  inputs: RenderInput[]
): Promise<Buffer[]> {
  if (inputs.length === 0) return []

  // Resolve the shared media URL to a data URI once (all variants share the same photo)
  const sharedMediaUrl = inputs[0].mediaUrl ?? null
  const resolvedMedia  = sharedMediaUrl ? await toDataUri(sharedMediaUrl) : null

  // Build HTML for every variant
  const items = inputs.map((input) => {
    const template = input.templateSlug ? getTemplate(input.templateSlug) : null
    const isVertical   = template && (template.type === "reel_cover" || template.type === "story")
    const dimTable     = isVertical ? VERTICAL_DIMS : PLATFORM_DIMS
    const [width, height] = dimTable[input.platform] ?? [1080, 1080]

    const resolvedInput = { ...input, mediaUrl: resolvedMedia ?? input.mediaUrl }

    let html: string
    if (template) {
      const data = buildTemplateData(resolvedInput, width, height)
      html = template.buildHtml(data)
    } else {
      const cardData: CardData = { ...resolvedInput, width, height }
      html = buildCardHtml(cardData)
    }

    return { html, width, height }
  })

  return renderHtmlsToPngs(items)
}

/** Resolve Chromium executable for local dev vs Vercel */
async function getChromiumPath(): Promise<string> {
  if (process.env.NODE_ENV === "production" || process.env.CHROMIUM_REMOTE_URL) {
    const chromium  = (await import("@sparticuz/chromium-min")).default
    const remoteUrl = process.env.CHROMIUM_REMOTE_URL
      ?? "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.tar"
    return chromium.executablePath(remoteUrl)
  }

  const { execSync } = await import("child_process")
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ]

  try {
    const which = execSync(
      "which google-chrome 2>/dev/null || which chromium-browser 2>/dev/null || which chromium 2>/dev/null",
      { encoding: "utf-8" }
    ).trim()
    if (which) return which
  } catch {}

  for (const path of candidates) {
    try {
      const fs = await import("fs")
      if (fs.existsSync(path)) return path
    } catch {}
  }

  throw new Error("No Chromium found. Install Google Chrome or set CHROMIUM_REMOTE_URL.")
}

function chromiumArgs(): string[] {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--single-process",
    "--no-zygote",
  ]
}
