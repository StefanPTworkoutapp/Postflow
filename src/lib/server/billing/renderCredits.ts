/**
 * Render credit helpers.
 *
 * Render credits are used for clip-forge video renders.
 * 1 credit = 1 render. Credits are purchased via Stripe one-time payments.
 *
 * Balance = SUM(amount) across render_credit_transactions for the account.
 * Negative amounts = deductions. Positive = purchases.
 */

import { createServiceClient } from "@/lib/supabase/service"

/**
 * Returns the current render credit balance for an account.
 * Uses a service client — safe to call from server-side API routes.
 */
export async function getRenderCreditBalance(accountId: string): Promise<number> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from("render_credit_transactions")
    .select("amount")
    .eq("account_id", accountId)

  return (data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)
}

/**
 * Add render credits to an account (on Stripe purchase webhook).
 */
export async function addRenderCredits(opts: {
  accountId: string
  amount:    number
  reason:    string
  stripePi?: string
}): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from("render_credit_transactions").insert({
    account_id: opts.accountId,
    amount:     opts.amount,
    reason:     opts.reason,
    stripe_pi:  opts.stripePi ?? null,
  })
}

/**
 * Deduct 1 render credit (called when a clip-forge render starts).
 * Returns false if there are insufficient credits.
 */
export async function deductRenderCredit(opts: {
  accountId: string
  jobId:     string
}): Promise<{ ok: boolean; balance: number }> {
  const balance = await getRenderCreditBalance(opts.accountId)
  if (balance <= 0) return { ok: false, balance }

  const supabase = createServiceClient()
  await supabase.from("render_credit_transactions").insert({
    account_id: opts.accountId,
    amount:     -1,
    reason:     "render_clip_forge",
    job_id:     opts.jobId,
  })

  return { ok: true, balance: balance - 1 }
}

/**
 * Credit pack definitions — used by the checkout API and billing UI.
 */
export interface CreditPack {
  id:         string   // key used in checkout + webhook
  credits:    number
  priceEur:   number
  priceLabel: string
  envKey:     string   // env var holding the Stripe price ID
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id:         "credits_10",
    credits:    10,
    priceEur:   9,
    priceLabel: "€9",
    envKey:     "STRIPE_CREDITS_10_PRICE",
  },
  {
    id:         "credits_50",
    credits:    50,
    priceEur:   39,
    priceLabel: "€39",
    envKey:     "STRIPE_CREDITS_50_PRICE",
  },
  {
    id:         "credits_100",
    credits:    100,
    priceEur:   69,
    priceLabel: "€69",
    envKey:     "STRIPE_CREDITS_100_PRICE",
  },
]

export function getCreditPackById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find(p => p.id === id)
}
