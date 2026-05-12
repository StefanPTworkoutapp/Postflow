/**
 * /inspiration — Inspiration Library
 *
 * Server component: loads saved inspiration_posts for the brand,
 * then mounts InspirationClient for interactivity.
 *
 * Guard: brand must exist (redirect to /onboarding if not).
 */

import { redirect }              from "next/navigation"
import { getBrand }              from "@/lib/server/brand/getBrand"
import { createServiceClient }   from "@/lib/supabase/service"
import { InspirationClient }     from "./InspirationClient"
import type { SavedAnalysis }    from "./InspirationClient"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (x: unknown) => x as any

export default async function InspirationPage() {
  const brand = await getBrand()
  if (!brand) redirect("/onboarding")

  const service = createServiceClient()

  // Load saved analyses for the library section.
  // We pull minimal fields needed for LibraryRow — heavy JSONB fields inlined selectively.
  const { data: rows } = await nt(service)
    .from("inspiration_posts")
    .select("id, source_url, platform, explanation, applied, applied_at, created_at, analysis, signals")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(50)

  // Shape the data for InspirationClient — keep the component type-safe
  const savedAnalyses: SavedAnalysis[] = ((rows ?? []) as Array<Record<string, unknown>>).map(r => {
    const analysis = (r.analysis as Record<string, unknown> | null) ?? {}
    const signals  = (r.signals  as unknown[]                | null) ?? []
    const patterns = (analysis.observed_patterns as string[] | undefined) ?? []

    return {
      id:                String(r.id),
      source_url:        String(r.source_url),
      platform:          String(r.platform),
      explanation:       r.explanation != null ? String(r.explanation) : null,
      applied:           Boolean(r.applied),
      applied_at:        r.applied_at != null ? String(r.applied_at) : null,
      created_at:        String(r.created_at),
      observed_patterns: patterns,
      signal_count:      signals.length,
    }
  })

  return <InspirationClient savedAnalyses={savedAnalyses} />
}
