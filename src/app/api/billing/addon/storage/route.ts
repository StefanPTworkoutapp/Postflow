/**
 * POST /api/billing/addon/storage
 *
 * Adds a storage add-on item to the user's existing Stripe subscription.
 * Stripe prorates billing automatically.
 *
 * Body: { addonGb: 50 | 200 | 500, interval: "monthly" | "annual" }
 *
 * The price ID is resolved server-side from env vars so no Stripe price IDs
 * are ever exposed to the client.
 *
 * Plan guard: only Starter+ can purchase add-ons (Free plan blocks).
 */

import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getStripe }           from "@/lib/server/billing/stripe"

// Maps addon size + interval → env var holding the Stripe price ID
const ADDON_PRICE_ENV_MAP: Record<string, Record<string, string>> = {
  "50": {
    monthly: "STRIPE_ADDON_STORAGE_50_MONTHLY",
    annual:  "STRIPE_ADDON_STORAGE_50_ANNUAL",
  },
  "200": {
    monthly: "STRIPE_ADDON_STORAGE_200_MONTHLY",
    annual:  "STRIPE_ADDON_STORAGE_200_ANNUAL",
  },
  "500": {
    monthly: "STRIPE_ADDON_STORAGE_500_MONTHLY",
    annual:  "STRIPE_ADDON_STORAGE_500_ANNUAL",
  },
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { addonGb: number; interval: string }
  const { addonGb, interval } = body

  if (!addonGb || !interval) {
    return NextResponse.json({ error: "addonGb and interval required" }, { status: 400 })
  }

  const envMap = ADDON_PRICE_ENV_MAP[String(addonGb)]
  if (!envMap) return NextResponse.json({ error: "Invalid addonGb. Must be 50, 200, or 500." }, { status: 400 })

  const envKey  = envMap[interval]
  if (!envKey)  return NextResponse.json({ error: "Invalid interval. Must be monthly or annual." }, { status: 400 })

  const priceId = process.env[envKey]
  if (!priceId) {
    return NextResponse.json({
      error: `Storage add-on pricing not yet configured. Contact support.`,
    }, { status: 503 })
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_tier, stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  if (account.subscription_tier === "free") {
    return NextResponse.json({
      error: "Storage add-ons are not available on the Free plan. Upgrade to Starter first.",
    }, { status: 403 })
  }

  // Get existing Stripe subscription
  const service = createServiceClient()
  const { data: sub } = await service
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("account_id", user.id)
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({
      error: "No active Stripe subscription found. Please subscribe to a plan first.",
    }, { status: 400 })
  }

  const stripe = getStripe()

  // Add the add-on price as a new subscription item.
  // Stripe prorates billing automatically (default proration_behavior).
  await stripe.subscriptionItems.create({
    subscription: sub.stripe_subscription_id,
    price:        priceId,
    quantity:     1,
  })

  // The customer.subscription.updated webhook fires and sets storage_addon_gb
  return NextResponse.json({ ok: true })
}
