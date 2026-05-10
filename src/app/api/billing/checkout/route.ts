/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe or Mollie checkout session for the given plan.
 * The payment provider is selected based on the `provider` field:
 *   - "stripe"  (default) — Stripe Checkout
 *   - "mollie"            — Mollie hosted payment page (iDEAL, SEPA, etc.)
 *
 * Body: { tier, interval, provider? }
 * Response: { url } — redirect the browser to this URL
 */

import { NextResponse } from "next/server"
import { createClient }  from "@/lib/supabase/server"
import { PLANS, type PlanTier, type BillingInterval } from "@/lib/server/billing/plans"
import { createStripeCheckoutSession }  from "@/lib/server/billing/stripe"
import { createMollieCheckoutUrl }      from "@/lib/server/billing/mollie"
import { z } from "zod"

const schema = z.object({
  tier:     z.enum(["starter", "pro", "business"]),
  interval: z.enum(["monthly", "annual"]),
  provider: z.enum(["stripe", "mollie"]).optional().default("stripe"),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const { tier, interval, provider } = parsed.data

  // Sanity check: free plan has no checkout
  if (!PLANS[tier]) return NextResponse.json({ error: "Unknown plan" }, { status: 400 })

  const { data: account } = await supabase
    .from("accounts")
    .select("id, email, name")
    .eq("id", user.id)
    .single()

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow.app"
  const successUrl = `${appUrl}/settings/billing?success=1`
  const cancelUrl  = `${appUrl}/settings/billing`

  try {
    let url: string

    if (provider === "mollie") {
      url = await createMollieCheckoutUrl({
        accountId:   account.id,
        email:       account.email,
        name:        account.name ?? undefined,
        tier:        tier as PlanTier,
        interval:    interval as BillingInterval,
        redirectUrl: successUrl,
        webhookUrl:  `${appUrl}/api/webhooks/mollie`,
      })
    } else {
      // Get existing subscription tier for trial eligibility
      const { data: existingAccount } = await supabase
        .from("accounts")
        .select("subscription_tier, subscription_status")
        .eq("id", account.id)
        .single()

      const isNewCustomer = !existingAccount
        || existingAccount.subscription_tier === "free"

      url = await createStripeCheckoutSession({
        accountId:   account.id,
        email:       account.email,
        name:        account.name ?? undefined,
        tier:        tier as PlanTier,
        interval:    interval as BillingInterval,
        successUrl,
        cancelUrl,
        withTrial:   isNewCustomer,
      })
    }

    return NextResponse.json({ url })
  } catch (err) {
    console.error("[billing/checkout]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    )
  }
}
