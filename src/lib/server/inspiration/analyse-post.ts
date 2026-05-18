/**
 * analyse-post — Core analysis engine for the Inspiration Link feature.
 *
 * Pipeline:
 *   1. Fetch post structure from Supadata web-scrape endpoint
 *   2. Pass raw content + brand context to Claude → extract token signals
 *
 * Returns structured signals ready for nudgeToken() and for display.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { BrandContext }    from "@/lib/server/brand/getBrandContext"
import type { SupportedPlatform } from "./url-validator"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InspirationSignal {
  token_key:        string
  value:            string | number
  confidence_delta: number   // always 0.08–0.12
  observed_pattern: string   // human-readable reason
}

export interface PostAnalysis {
  platform:        SupportedPlatform
  post_type:       "reel" | "carousel" | "image" | "video" | "unknown"
  observed_patterns: string[]   // "What makes this work" list
  signals:         InspirationSignal[]
  raw_supadata:    Record<string, unknown>
}

// ── Supadata fetch ─────────────────────────────────────────────────────────────

interface SuperdataResult {
  content:   string
  metadata?: Record<string, unknown>
}

type SupadataError =
  | "private_account"
  | "post_deleted"
  | "scrape_failed"

export class InspirationFetchError extends Error {
  constructor(public readonly reason: SupadataError) {
    super(reason)
  }
}

async function fetchPostFromSupadata(url: string): Promise<SuperdataResult> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) throw new Error("SUPADATA_API_KEY is not configured")

  const res = await fetch("https://api.supadata.ai/v1/web/scrape", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    apiKey,
    },
    body: JSON.stringify({ url }),
    // 30s timeout via AbortSignal
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    // Map Supadata errors to our domain errors
    if (res.status === 403 || body.toLowerCase().includes("private")) {
      throw new InspirationFetchError("private_account")
    }
    if (res.status === 404 || body.toLowerCase().includes("not found")) {
      throw new InspirationFetchError("post_deleted")
    }
    throw new InspirationFetchError("scrape_failed")
  }

  const json = await res.json() as SuperdataResult
  if (!json.content && !json.metadata) {
    throw new InspirationFetchError("scrape_failed")
  }
  return json
}

// ── Claude signal extraction ──────────────────────────────────────────────────

function buildSignalPrompt(
  url:       string,
  platform:  SupportedPlatform,
  content:   string,
  metadata:  Record<string, unknown>,
  brandCtx:  BrandContext,
): string {
  const metaStr = Object.keys(metadata).length
    ? `\nMETADATA:\n${JSON.stringify(metadata, null, 2)}`
    : ""

  return `You are PostFlow's brand intelligence engine. A user has shared an inspiring ${platform} post for analysis.

BRAND CONTEXT:
${brandCtx.promptBlock}

INSPIRATION POST:
URL: ${url}
Platform: ${platform}
Scraped content:
${content.slice(0, 4000)}${metaStr}

Your task:
1. Identify what makes this post effective for the brand's niche and goals.
2. Map observed patterns to brand token signals.

RETURN ONLY valid JSON — no markdown, no explanation outside the JSON.

JSON structure:
{
  "post_type": "reel" | "carousel" | "image" | "video" | "unknown",
  "observed_patterns": [
    "String — plain English observation about why this post works (max 8 items)"
  ],
  "signals": [
    {
      "token_key": "one of: hook_style | hook_duration_seconds | pacing | text_overlay_style | music_energy | music_genre | caption_tone | hashtag_strategy | carousel_slide_count | carousel_content_mix | carousel_text_overlay_density | carousel_hook_style | carousel_slide_pacing",
      "value": "the specific value to apply (string or number — match the token's type)",
      "confidence_delta": 0.10,
      "observed_pattern": "One sentence explaining what in the post suggests this value"
    }
  ]
}

Rules:
- Only include signals you can actually observe from the content — do not guess.
- confidence_delta must be between 0.08 and 0.12 (inspiration is weaker than direct feedback).
- For carousel_* tokens, only include if the post is clearly a carousel.
- hook_duration_seconds must be a number (seconds, 1–10).
- Keep observed_patterns practical and specific, not generic ("Strong hook in first 2 seconds" not "Good hook").
- Maximum 8 signals total.`
}

interface ClaudeSignalResponse {
  post_type:         string
  observed_patterns: string[]
  signals:           Array<{
    token_key:        string
    value:            string | number
    confidence_delta: number
    observed_pattern: string
  }>
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function analyseInspirationPost(
  url:      string,
  platform: SupportedPlatform,
  brand:    BrandContext,
  brandId?: string | null,
): Promise<PostAnalysis> {
  // 1. Fetch from Supadata (throws InspirationFetchError on failure)
  const scraped = await fetchPostFromSupadata(url)

  // 2. Claude extracts signals
  const prompt = buildSignalPrompt(
    url,
    platform,
    scraped.content ?? "",
    scraped.metadata ?? {},
    brand,
  )

  const message = await claude.messages.create({
    model:      MODELS.inspireAnalyze,
    max_tokens: 1024,
    messages:   [{ role: "user", content: prompt }],
  })
  logAiUsage({ brandId: brandId ?? null, model: MODELS.inspireAnalyze, feature: "inspire_analyze", usage: message.usage })

  const rawText = message.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")

  let parsed: ClaudeSignalResponse
  try {
    // Strip any accidental markdown code fences
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    parsed = JSON.parse(cleaned) as ClaudeSignalResponse
  } catch {
    throw new Error(`Claude returned invalid JSON: ${rawText.slice(0, 200)}`)
  }

  // 3. Clamp confidence_delta to safe range
  const signals: InspirationSignal[] = (parsed.signals ?? []).map(s => ({
    token_key:        s.token_key,
    value:            s.value,
    confidence_delta: Math.max(0.08, Math.min(0.12, s.confidence_delta ?? 0.10)),
    observed_pattern: s.observed_pattern,
  }))

  const postType = (["reel", "carousel", "image", "video"].includes(parsed.post_type)
    ? parsed.post_type
    : "unknown") as PostAnalysis["post_type"]

  return {
    platform,
    post_type:         postType,
    observed_patterns: parsed.observed_patterns ?? [],
    signals,
    raw_supadata:      { content: scraped.content?.slice(0, 2000), metadata: scraped.metadata },
  }
}
