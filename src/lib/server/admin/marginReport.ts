/**
 * Per-company margin report — server-side aggregation only, no client-side
 * math. Shared by:
 *   - /admin dashboard "Company margins" section (src/app/(app)/admin/page.tsx)
 *   - Monthly cost & margin email (src/inngest/jobs/monthlyMarginEmail.ts)
 *
 * "Company" == postflow.accounts row (the entitlement/billing unit — a
 * brand's account_id points here). One row per account with a payment
 * history or AI usage.
 *
 * Currency: payments are EUR (Stripe/Mollie prices are quoted in EUR),
 * AI cost is billed by Anthropic in USD. Converted with a fixed approximate
 * rate (USD_TO_EUR from aiBudget.ts) — NOT a live FX feed. Everything in
 * this report is displayed in EUR.
 *
 * Storage add-on revenue: Stripe adds the add-on as a subscription line item
 * (customer.subscription.updated), so its cost is already folded into that
 * account's invoice.paid total — it is NOT added again here, to avoid double
 * counting. storageAddonGb is surfaced separately as an indicator, not a
 * revenue line.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { USD_TO_EUR, checkAiBudget } from "@/lib/server/billing/aiBudget"
import { CREDIT_PACKS } from "@/lib/server/billing/renderCredits"
import type { PlanTier } from "@/lib/server/billing/plans"

export interface CompanyMarginRow {
  accountId:          string
  name:               string
  plan:               string
  thisMonth: {
    revenueEur:          number   // subscription invoices + render credit purchases
    aiCostUsd:            number
    aiCostEur:            number
    renderCreditRevenueEur: number
    marginEur:            number
  }
  lifetime: {
    revenueEur:          number
    aiCostUsd:            number
    aiCostEur:            number
    marginEur:            number
  }
  storageAddonGb: number
  overBudget:     "normal" | "economy" | "blocked"
}

export interface MarginReportTotals {
  thisMonth: { revenueEur: number; aiCostEur: number; marginEur: number }
  lifetime:  { revenueEur: number; aiCostEur: number; marginEur: number }
}

export interface MarginReport {
  generatedAt: string
  month:       string
  totals:      MarginReportTotals
  companies:   CompanyMarginRow[]
}

/** Maps a render_credit_transactions purchase row's credit amount to its EUR price. */
function creditsToEur(credits: number): number {
  const pack = CREDIT_PACKS.find(p => p.credits === credits)
  return pack?.priceEur ?? 0
}

export async function getMarginReport(): Promise<MarginReport> {
  const supabase = createServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthLabel = now.toLocaleString("en-GB", { month: "long", year: "numeric" })

  const [
    { data: accounts },
    { data: subscriptions },
    { data: invoices },
    { data: renderTx },
    { data: brands },
  ] = await Promise.all([
    supabase.from("accounts").select("id, name, email, subscription_tier"),
    supabase.from("subscriptions").select("account_id, plan, storage_addon_gb"),
    supabase.from("invoices").select("account_id, total_cents, status, paid_at")
      .eq("status", "paid"),
    supabase.from("render_credit_transactions").select("account_id, amount, created_at")
      .gt("amount", 0),
    supabase.from("brands").select("id, account_id"),
  ])

  const brandToAccount = new Map((brands ?? []).map(b => [b.id, b.account_id]))
  const brandIds = (brands ?? []).map(b => b.id)

  // ai_usage_logs has no account_id column — resolve via brand_id in batches
  // (Supabase .in() caps around 1000 items comfortably for this scale).
  const { data: aiLogs } = brandIds.length
    ? await supabase.from("ai_usage_logs").select("brand_id, cost_usd, created_at").in("brand_id", brandIds)
    : { data: [] as Array<{ brand_id: string | null; cost_usd: number; created_at: string }> }

  const subByAccount = new Map((subscriptions ?? []).map(s => [s.account_id, s]))

  interface Acc {
    revenueMonthCents: number
    revenueLifetimeCents: number
    aiCostMonthUsd: number
    aiCostLifetimeUsd: number
    renderRevenueMonthEur: number
    renderRevenueLifetimeEur: number
  }
  const perAccount = new Map<string, Acc>()
  const ensure = (id: string): Acc => {
    let a = perAccount.get(id)
    if (!a) {
      a = {
        revenueMonthCents: 0, revenueLifetimeCents: 0,
        aiCostMonthUsd: 0, aiCostLifetimeUsd: 0,
        renderRevenueMonthEur: 0, renderRevenueLifetimeEur: 0,
      }
      perAccount.set(id, a)
    }
    return a
  }

  for (const inv of (invoices ?? [])) {
    if (!inv.account_id) continue
    const a = ensure(inv.account_id)
    a.revenueLifetimeCents += inv.total_cents ?? 0
    if (inv.paid_at && inv.paid_at >= monthStart) a.revenueMonthCents += inv.total_cents ?? 0
  }

  for (const tx of (renderTx ?? [])) {
    if (!tx.account_id) continue
    const a = ensure(tx.account_id)
    const eur = creditsToEur(tx.amount)
    a.renderRevenueLifetimeEur += eur
    if (tx.created_at >= monthStart) a.renderRevenueMonthEur += eur
  }

  for (const log of (aiLogs ?? [])) {
    const accountId = log.brand_id ? brandToAccount.get(log.brand_id) : null
    if (!accountId) continue // unattributed (e.g. shared niche research, brand_id: null) — excluded from per-company cost
    const a = ensure(accountId)
    const cost = Number(log.cost_usd ?? 0)
    a.aiCostLifetimeUsd += cost
    if (log.created_at >= monthStart) a.aiCostMonthUsd += cost
  }

  const budgetVerdicts = await Promise.all(
    (accounts ?? []).map(async acc => ({
      id: acc.id,
      verdict: (await checkAiBudget(acc.id, acc.subscription_tier ?? "free")).verdict,
    }))
  )
  const verdictByAccount = new Map(budgetVerdicts.map(v => [v.id, v.verdict]))

  const companies: CompanyMarginRow[] = (accounts ?? [])
    .filter(acc => perAccount.has(acc.id)) // only accounts with billing/AI activity
    .map(acc => {
      const a = perAccount.get(acc.id)!
      const sub = subByAccount.get(acc.id)

      const revenueMonthEur    = a.revenueMonthCents / 100 + a.renderRevenueMonthEur
      const revenueLifetimeEur = a.revenueLifetimeCents / 100 + a.renderRevenueLifetimeEur
      const aiCostMonthEur     = a.aiCostMonthUsd * USD_TO_EUR
      const aiCostLifetimeEur  = a.aiCostLifetimeUsd * USD_TO_EUR

      return {
        accountId: acc.id,
        name:      acc.name ?? acc.email ?? acc.id,
        plan:      (sub?.plan ?? acc.subscription_tier ?? "free") as PlanTier,
        thisMonth: {
          revenueEur:             revenueMonthEur,
          aiCostUsd:              a.aiCostMonthUsd,
          aiCostEur:              aiCostMonthEur,
          renderCreditRevenueEur: a.renderRevenueMonthEur,
          marginEur:              revenueMonthEur - aiCostMonthEur,
        },
        lifetime: {
          revenueEur: revenueLifetimeEur,
          aiCostUsd:  a.aiCostLifetimeUsd,
          aiCostEur:  aiCostLifetimeEur,
          marginEur:  revenueLifetimeEur - aiCostLifetimeEur,
        },
        storageAddonGb: sub?.storage_addon_gb ?? 0,
        overBudget:     verdictByAccount.get(acc.id) ?? "normal",
      }
    })
    // Negative-margin companies first (worst this-month margin first), then by AI cost desc
    .sort((a, b) => a.thisMonth.marginEur - b.thisMonth.marginEur)

  const totals: MarginReportTotals = companies.reduce(
    (t, c) => ({
      thisMonth: {
        revenueEur: t.thisMonth.revenueEur + c.thisMonth.revenueEur,
        aiCostEur:  t.thisMonth.aiCostEur + c.thisMonth.aiCostEur,
        marginEur:  t.thisMonth.marginEur + c.thisMonth.marginEur,
      },
      lifetime: {
        revenueEur: t.lifetime.revenueEur + c.lifetime.revenueEur,
        aiCostEur:  t.lifetime.aiCostEur + c.lifetime.aiCostEur,
        marginEur:  t.lifetime.marginEur + c.lifetime.marginEur,
      },
    }),
    {
      thisMonth: { revenueEur: 0, aiCostEur: 0, marginEur: 0 },
      lifetime:  { revenueEur: 0, aiCostEur: 0, marginEur: 0 },
    } as MarginReportTotals,
  )

  return { generatedAt: new Date().toISOString(), month: monthLabel, totals, companies }
}
