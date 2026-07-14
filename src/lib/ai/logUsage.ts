/**
 * Fire-and-forget AI usage logger.
 *
 * Call this immediately after every client.messages.create() call.
 * It never blocks the response — errors are swallowed and logged to console only.
 *
 * PRICING TABLE — update when Anthropic changes prices.
 * All values are USD per 1 000 000 tokens.
 * Source: https://www.anthropic.com/pricing (last verified 2026-07-14)
 */

import { createServiceClient } from "@/lib/supabase/service"

// ── Pricing ──────────────────────────────────────────────────────────────────

interface ModelPricing {
  input:       number   // per 1M input tokens
  output:      number   // per 1M output tokens
  cache_read:  number   // per 1M cache-read tokens
  cache_write: number   // per 1M cache-write tokens
}

const PRICING: Record<string, ModelPricing> = {
  // Historical models — kept so old ai_usage_logs rows (and any stray calls
  // still referencing them) compute a real cost instead of silently zeroing.
  "claude-opus-4-5":   { input: 15.00, output: 75.00, cache_read: 1.50,  cache_write: 18.75 },
  "claude-sonnet-4-6": { input: 3.00,  output: 15.00, cache_read: 0.30,  cache_write: 3.75  },
  // Current models (P5 right-sizing, 2026-07-14)
  "claude-sonnet-5":   { input: 3.00,  output: 15.00, cache_read: 0.30,  cache_write: 3.75  },
  "claude-haiku-4-5":  { input: 1.00,  output: 5.00,  cache_read: 0.10,  cache_write: 1.25  },
}

function computeCost(model: string, usage: UsagePayload): number {
  const p = PRICING[model] ?? { input: 0, output: 0, cache_read: 0, cache_write: 0 }
  return (
    usage.input_tokens        * p.input       +
    usage.output_tokens       * p.output      +
    (usage.cache_read_input_tokens   ?? 0) * p.cache_read  +
    (usage.cache_creation_input_tokens ?? 0) * p.cache_write
  ) / 1_000_000
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UsagePayload {
  input_tokens:                   number
  output_tokens:                  number
  cache_read_input_tokens?:       number | null
  cache_creation_input_tokens?:   number | null
}

export interface LogAiUsageParams {
  brandId:  string | null | undefined
  model:    string
  /** One of the keys from src/lib/ai/models.ts — e.g. "caption", "calendar", "tone_extraction". */
  feature:  string
  usage:    UsagePayload
}

// ── Logger ────────────────────────────────────────────────────────────────────

/**
 * Log one AI call. Non-blocking — call without await.
 *
 * @example
 * const message = await client.messages.create({ model, ... })
 * logAiUsage({ brandId: brand?.id ?? null, model, feature: "caption", usage: message.usage })
 */
export function logAiUsage(params: LogAiUsageParams): void {
  _persist(params).catch((err) =>
    console.error("[logAiUsage] failed to persist usage log:", err)
  )
}

async function _persist({ brandId, model, feature, usage }: LogAiUsageParams): Promise<void> {
  const supabase = createServiceClient()

  await supabase.from("ai_usage_logs").insert({
    brand_id:           brandId ?? null,
    model,
    feature,
    input_tokens:       usage.input_tokens,
    output_tokens:      usage.output_tokens,
    cache_read_tokens:  usage.cache_read_input_tokens        ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens    ?? 0,
    cost_usd:           computeCost(model, usage),
  })
}
