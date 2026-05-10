/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session.
 * Users who paid via Mollie are redirected to a static management page
 * (Mollie doesn't have a hosted portal equivalent).
 *
 * Response: { url }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createStripePortalSession } from "@/lib/server/billing/stripe"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id, mollie_customer_id")
    .eq("id", user.id)
    .single()

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow.app"
  const returnUrl = `${appUrl}/settings/billing`

  // Stripe portal
  if (account.stripe_customer_id) {
    try {
      const url = await createStripePortalSession({
        stripeCustomerId: account.stripe_customer_id,
        returnUrl,
      })
      return NextResponse.json({ url })
    } catch (err) {
      console.error("[billing/portal]", err)
      return NextResponse.json({ error: "Portal session failed" }, { status: 500 })
    }
  }

  // Mollie: no portal — return a mailto link with subject pre-filled
  if (account.mollie_customer_id) {
    return NextResponse.json({
      url: `mailto:hello@postflow.app?subject=Subscription%20management%20request`,
    })
  }

  return NextResponse.json({ error: "No payment provider linked" }, { status: 400 })
}
