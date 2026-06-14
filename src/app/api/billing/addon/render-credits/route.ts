/**
 * POST /api/billing/addon/render-credits
 *
 * Creates a Stripe Checkout Session (mode: "payment") to purchase a render
 * credit pack. On success, Stripe fires checkout.session.completed and the
 * webhook adds the credits.
 *
 * Body: { packId: "credits_10" | "credits_50" | "credits_100" }
 */

import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { getStripe, getOrCreateStripeCustomer } from "@/lib/server/billing/stripe"
import { CREDIT_PACKS, getCreditPackById }       from "@/lib/server/billing/renderCredits"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { packId: string }
  if (!body.packId) return NextResponse.json({ error: "packId required" }, { status: 400 })

  const pack = getCreditPackById(body.packId)
  if (!pack) {
    return NextResponse.json({
      error: `Invalid packId. Valid options: ${CREDIT_PACKS.map(p => p.id).join(", ")}`,
    }, { status: 400 })
  }

  const priceId = process.env[pack.envKey]
  if (!priceId) {
    return NextResponse.json({
      error: "Render credit pricing not yet configured. Contact support.",
    }, { status: 503 })
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_tier, email, name, stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const customerId = await getOrCreateStripeCustomer({
    accountId: user.id,
    email:     account.email ?? user.email ?? "",
    name:      account.name ?? undefined,
  })

  const stripe = getStripe()
  const origin = req.headers.get("origin") ?? "https://postflowsocials.app"

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        "payment",
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?credits=purchased`,
    cancel_url:  `${origin}/settings/billing`,
    payment_intent_data: {
      metadata: {
        postflow_account_id: user.id,
        credit_pack_id:      pack.id,
        credits:             String(pack.credits),
      },
    },
  })

  return NextResponse.json({ url: session.url })
}
