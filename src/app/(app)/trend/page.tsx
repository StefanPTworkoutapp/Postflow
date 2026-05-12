/**
 * /trend — Trend Builder (trend-forge)
 *
 * Generates trend-aligned video concepts from niche trends,
 * renders parallel A/B versions, and guides the user to pick + schedule.
 *
 * Guard: brand must exist + ≥1 platform connected (soft check — ConnectPrompt shown if needed).
 */

import { redirect }      from "next/navigation"
import { getBrand }      from "@/lib/server/brand/getBrand"
import { TrendClient }   from "./TrendClient"

export default async function TrendPage() {
  const brand = await getBrand()
  if (!brand) redirect("/onboarding")

  return <TrendClient />
}
