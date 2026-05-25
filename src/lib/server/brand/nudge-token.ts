/**
 * nudgeToken — the ONLY function that updates postflow.brands.intelligence_tokens.
 *
 * Rules:
 * - Always writes an audit row to postflow.brand_token_events (no exceptions).
 * - Enforces a confidence floor of 0.60 for calibration-locked tokens.
 * - Only shifts the token value when the signal threshold is met.
 * - Never UPDATE brands.intelligence_tokens directly — always call this function.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { Json } from "@/types/database.types"

export type SignalType =
  | "analytics"
  | "feedback"
  | "manual"
  | "reject"
  | "calibration"
  | "inspiration"

interface TokenEntry {
  value:              string | number | string[]
  confidence:         number
  calibration_locked?: boolean
  range?:             [number, number]
  options?:           string[]
}

interface BrandTokens {
  [key: string]: TokenEntry
}

/**
 * Update a single brand token and write the audit trail.
 *
 * @param brandId         - brands.id UUID
 * @param tokenKey        - key in brands.intelligence_tokens JSONB
 * @param newValue        - the new value to set (only applied when threshold met)
 * @param confidenceDelta - positive = reinforce, negative = weaken
 * @param signalType      - source of the signal
 * @param sourceId        - optional post_id, job_id, or URL for audit trail
 * @param detail          - optional extra context stored in signal_detail JSONB
 * @param allowCreate     - if true and the token doesn't exist yet, create it with
 *                          newValue and abs(confidenceDelta) as starting confidence.
 *                          Use for new token types that didn't exist at calibration time.
 */
export async function nudgeToken(
  brandId:         string,
  tokenKey:        string,
  newValue:        string | number | string[],
  confidenceDelta: number,
  signalType:      SignalType,
  sourceId?:       string,
  detail?:         Record<string, unknown>,
  allowCreate?:    boolean,
): Promise<void> {
  const supabase = createServiceClient()

  // 1. Fetch current intelligence_tokens for this brand
  const { data: brand, error: fetchError } = await supabase
    .from("brands")
    .select("intelligence_tokens")
    .eq("id", brandId)
    .single()

  if (fetchError || !brand) {
    console.error(`nudgeToken: failed to fetch brand ${brandId}:`, fetchError?.message)
    return
  }

  const tokens = (brand.intelligence_tokens ?? {}) as unknown as BrandTokens
  const token  = tokens[tokenKey]

  if (!token) {
    if (allowCreate) {
      // Auto-create the token. Start at a low confidence equal to |confidenceDelta|
      // so the caller's signal is the first data point, not a hard override.
      const startConfidence = Math.min(0.40, Math.abs(confidenceDelta))
      const newToken: TokenEntry = {
        value:      newValue,
        confidence: startConfidence,
      }
      const updatedTokens: BrandTokens = { ...tokens, [tokenKey]: newToken }
      const { error: createError } = await supabase
        .from("brands")
        .update({ intelligence_tokens: updatedTokens as unknown as Json })
        .eq("id", brandId)
      if (createError) {
        console.error(`nudgeToken: failed to create token "${tokenKey}" for brand ${brandId}:`, createError.message)
        return
      }
      await supabase.from("brand_token_events").insert({
        brand_id:         brandId,
        token_key:        tokenKey,
        old_value:        "",
        new_value:        String(newValue),
        old_confidence:   0,
        new_confidence:   startConfidence,
        signal_type:      signalType,
        signal_source_id: sourceId ?? null,
        signal_detail:    ({ ...(detail ?? {}), auto_created: true }) as unknown as Json,
      })
    } else {
      console.warn(`nudgeToken: unknown token key "${tokenKey}" for brand ${brandId} — skipping`)
    }
    return
  }

  // 2. Calculate new confidence with floor enforcement
  const isCalibrated  = token.calibration_locked === true
  const minConfidence = isCalibrated ? 0.60 : 0.0
  const newConfidence = Math.max(
    minConfidence,
    Math.min(1.0, token.confidence + confidenceDelta)
  )

  // 3. Decide whether to shift the value
  //    Feedback and calibration always shift.
  //    Analytics only shift after meaningful data accumulates (handled by caller).
  //    Inspiration shifts at reduced weight — handled by the delta passed in.
  const shouldShiftValue =
    signalType === "feedback"     ||
    signalType === "calibration"  ||
    signalType === "inspiration"  ||
    signalType === "manual"       ||
    signalType === "analytics"    ||
    signalType === "reject"

  // Clamp numeric values to range if defined
  let resolvedValue: string | number | string[] = shouldShiftValue ? newValue : token.value
  if (
    shouldShiftValue &&
    typeof resolvedValue === "number" &&
    token.range
  ) {
    resolvedValue = Math.max(token.range[0], Math.min(token.range[1], resolvedValue))
  }

  const updatedToken: TokenEntry = {
    ...token,
    value:      resolvedValue,
    confidence: newConfidence,
  }

  const updatedTokens: BrandTokens = {
    ...tokens,
    [tokenKey]: updatedToken,
  }

  // 4. Write updated tokens back to brands
  const { error: updateError } = await supabase
    .from("brands")
    .update({ intelligence_tokens: updatedTokens as unknown as Json })
    .eq("id", brandId)

  if (updateError) {
    console.error(`nudgeToken: failed to update brand ${brandId} token "${tokenKey}":`, updateError.message)
    return
  }

  // 5. Write audit row — always, no exceptions
  const { error: auditError } = await supabase
    .from("brand_token_events")
    .insert({
      brand_id:         brandId,
      token_key:        tokenKey,
      old_value:        String(token.value),
      new_value:        String(resolvedValue),
      old_confidence:   token.confidence,
      new_confidence:   newConfidence,
      signal_type:      signalType,
      signal_source_id: sourceId ?? null,
      signal_detail:    (detail ?? null) as Json | null,
    })

  if (auditError) {
    // Audit failure is serious but must not crash the caller
    console.error(`nudgeToken: failed to write audit row for brand ${brandId} token "${tokenKey}":`, auditError.message)
  }
}

/**
 * Seed multiple tokens at once during First Post Calibration.
 * All seeded tokens get confidence 0.60 (calibration floor) and calibration_locked=true.
 */
export async function seedCalibrationTokens(
  brandId: string,
  seeds:   Array<{ key: string; value: string | number | string[] }>
): Promise<void> {
  const supabase = createServiceClient()

  const { data: brand, error: fetchError } = await supabase
    .from("brands")
    .select("intelligence_tokens")
    .eq("id", brandId)
    .single()

  if (fetchError || !brand) {
    console.error(`seedCalibrationTokens: failed to fetch brand ${brandId}`)
    return
  }

  const tokens = (brand.intelligence_tokens ?? {}) as unknown as BrandTokens

  const updatedTokens = { ...tokens }
  for (const seed of seeds) {
    const existing = tokens[seed.key]
    updatedTokens[seed.key] = {
      ...(existing ?? {}),
      value:              seed.value,
      confidence:         0.60,
      calibration_locked: true,
    }
  }

  const { error } = await supabase
    .from("brands")
    .update({
      intelligence_tokens: updatedTokens as unknown as Json,
      calibration_status:  "complete",
    })
    .eq("id", brandId)

  if (error) {
    console.error(`seedCalibrationTokens: update failed for brand ${brandId}:`, error.message)
    return
  }

  // Audit all seeds
  await Promise.allSettled(
    seeds.map(seed =>
      supabase.from("brand_token_events").insert({
        brand_id:       brandId,
        token_key:      seed.key,
        old_value:      String(tokens[seed.key]?.value ?? ""),
        new_value:      String(seed.value),
        old_confidence: tokens[seed.key]?.confidence ?? 0,
        new_confidence: 0.60,
        signal_type:    "calibration",
        signal_detail:  { source: "first_post_calibration" } as unknown as Json,
      })
    )
  )
}
