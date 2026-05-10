/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events (HMAC-verified).
 * Delegates to handleStripeWebhook() which updates accounts + subscriptions.
 *
 * Must be registered in the Stripe dashboard pointing to:
 *   https://postflow.app/api/webhooks/stripe
 *
 * Required env: STRIPE_WEBHOOK_SECRET
 */

import { NextResponse } from "next/server"
import { handleStripeWebhook } from "@/lib/server/billing/stripe"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  const payload = await req.text()

  try {
    const result = await handleStripeWebhook(payload, signature)
    return NextResponse.json({ received: true, result })
  } catch (err) {
    console.error("[webhook/stripe]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook processing failed" },
      { status: 400 }
    )
  }
}
