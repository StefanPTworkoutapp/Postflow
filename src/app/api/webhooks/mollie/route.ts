/**
 * POST /api/webhooks/mollie
 *
 * Receives Mollie payment webhook notifications.
 * Mollie sends a form-encoded body with `id` (payment ID).
 *
 * Must be registered as the webhookUrl when creating Mollie payments/subscriptions.
 * No signature header — Mollie relies on HTTPS + payment ID verification.
 *
 * Required env: MOLLIE_API_KEY
 */

import { NextResponse } from "next/server"
import { handleMollieWebhook } from "@/lib/server/billing/mollie"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let paymentId: string | null = null

  // Mollie sends application/x-www-form-urlencoded: id=tr_xxx
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text   = await req.text()
    const params = new URLSearchParams(text)
    paymentId    = params.get("id")
  } else {
    const body = await req.json().catch(() => null)
    paymentId  = body?.id ?? null
  }

  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment ID" }, { status: 400 })
  }

  try {
    const result = await handleMollieWebhook(paymentId)
    return NextResponse.json({ received: true, result })
  } catch (err) {
    console.error("[webhook/mollie]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 500 }
    )
  }
}
