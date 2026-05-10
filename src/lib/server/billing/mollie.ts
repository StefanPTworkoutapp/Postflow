/**
 * Mollie billing helpers — compatible with @mollie/api-client v4.
 *
 * v4 API changes relevant here:
 *  - Payments are created with SequenceType enum, not string literals
 *  - Payment checkout URL: payment._links.checkout?.href (not getCheckoutUrl())
 *  - Mandates listing: customerMandates.page() returns Page<Mandate>
 *
 * Mollie flow:
 *  1. Create a first payment → user pays → mandate is established
 *  2. Webhook fires → we create a recurring subscription
 *  3. Each recurring payment fires a webhook → we update invoice table
 *
 * Lazy-init: getMollie() avoids build-time errors if MOLLIE_API_KEY is absent.
 */

import createMollieClient, { SequenceType, MandateStatus } from "@mollie/api-client"
import { PLANS, TRIAL_DAYS, type PlanTier, type BillingInterval } from "./plans"

type MollieClient = ReturnType<typeof createMollieClient>

let _mollie: MollieClient | null = null

export function getMollie(): MollieClient {
  if (!_mollie) {
    _mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY! })
  }
  return _mollie
}

/**
 * Creates or retrieves a Mollie customer for the given account.
 */
export async function getOrCreateMollieCustomer(opts: {
  accountId: string
  email:     string
  name?:     string
}): Promise<string> {
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()

  const { data: account } = await supabase
    .from("accounts")
    .select("mollie_customer_id")
    .eq("id", opts.accountId)
    .single()

  if (account?.mollie_customer_id) return account.mollie_customer_id

  const mollie   = getMollie()
  const customer = await mollie.customers.create({
    name:     opts.name ?? opts.email,
    email:    opts.email,
    metadata: { postflow_account_id: opts.accountId } as Record<string, unknown>,
  })

  await supabase
    .from("accounts")
    .update({ mollie_customer_id: customer.id })
    .eq("id", opts.accountId)

  return customer.id
}

/**
 * Creates a Mollie first-payment checkout URL.
 */
export async function createMollieCheckoutUrl(opts: {
  accountId:   string
  email:       string
  name?:       string
  tier:        PlanTier
  interval:    BillingInterval
  redirectUrl: string
  webhookUrl:  string
}): Promise<string> {
  const plan    = PLANS[opts.tier]
  const mollie  = getMollie()
  const amountEurCents = opts.interval === "annual"
    ? plan.annualEurCents
    : plan.monthlyEurCents

  const customerId = await getOrCreateMollieCustomer({
    accountId: opts.accountId,
    email:     opts.email,
    name:      opts.name,
  })

  const payment = await mollie.customerPayments.create({
    customerId,
    amount:       { currency: "EUR", value: formatMollieAmount(amountEurCents) },
    description:  `PostFlow ${plan.name} — ${opts.interval === "annual" ? "Annual" : "Monthly"}`,
    redirectUrl:  opts.redirectUrl,
    webhookUrl:   opts.webhookUrl,
    sequenceType: SequenceType.first,
    metadata: {
      postflow_account_id: opts.accountId,
      plan:                opts.tier,
      billing_interval:    opts.interval,
      is_first_payment:    "true",
    } as Record<string, unknown>,
  })

  // v4: checkout URL is in _links.checkout.href
  const checkoutUrl = payment._links.checkout?.href
  if (!checkoutUrl) throw new Error("No checkout URL returned by Mollie")
  return checkoutUrl
}

/**
 * Creates a Mollie recurring subscription after the first payment succeeds.
 */
export async function createMollieSubscription(opts: {
  mollieCustomerId: string
  accountId:        string
  tier:             PlanTier
  interval:         BillingInterval
  mandateId:        string
  webhookUrl:       string
}): Promise<string> {
  const plan   = PLANS[opts.tier]
  const mollie = getMollie()
  const amountEurCents = opts.interval === "annual"
    ? plan.annualEurCents
    : plan.monthlyEurCents

  const startDate = trialStartDate()

  const sub = await mollie.customerSubscriptions.create({
    customerId:  opts.mollieCustomerId,
    amount:      { currency: "EUR", value: formatMollieAmount(amountEurCents) },
    interval:    opts.interval === "annual" ? "12 months" : "1 month",
    startDate,
    description: `PostFlow ${plan.name}`,
    webhookUrl:  opts.webhookUrl,
    mandateId:   opts.mandateId,
    metadata: {
      postflow_account_id: opts.accountId,
      plan:                opts.tier,
    } as Record<string, unknown>,
  })

  return sub.id
}

/**
 * Handles an incoming Mollie webhook event (paymentId in form body).
 */
export async function handleMollieWebhook(
  paymentId: string,
): Promise<{ accountId: string; tier: string; status: string } | null> {
  const mollie  = getMollie()
  const payment = await mollie.payments.get(paymentId)

  const meta      = payment.metadata as Record<string, string> | null
  const accountId = meta?.postflow_account_id
  if (!accountId) return null

  const tier     = meta?.plan ?? "starter"
  const interval = (meta?.billing_interval ?? "monthly") as BillingInterval
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()

  if (payment.status === "paid") {
    const isFirst = meta?.is_first_payment === "true"

    const { data: account } = await supabase
      .from("accounts")
      .select("mollie_customer_id")
      .eq("id", accountId)
      .single()

    let mollieSubId: string | null = null

    if (isFirst && account?.mollie_customer_id) {
      // v4: use page() to list mandates
      const mandatesPage = await mollie.customerMandates.page({
        customerId: account.mollie_customer_id,
      })
      const validMandate = mandatesPage.find(m => m.status === MandateStatus.valid)

      if (validMandate) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow.app"
        mollieSubId = await createMollieSubscription({
          mollieCustomerId: account.mollie_customer_id,
          accountId,
          tier:      tier as PlanTier,
          interval,
          mandateId: validMandate.id,
          webhookUrl: `${appUrl}/api/webhooks/mollie`,
        })
      }
    }

    const periodMonths = interval === "annual" ? 12 : 1
    const periodEnd    = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths)

    const plan        = PLANS[tier as PlanTier]
    const amountCents = interval === "annual" ? plan.annualEurCents : plan.monthlyEurCents

    await Promise.all([
      supabase.from("accounts").update({
        subscription_tier:   tier,
        subscription_status: "active",
      }).eq("id", accountId),

      supabase.from("subscriptions").upsert({
        account_id:             accountId,
        plan:                   tier,
        status:                 "active",
        provider:               "mollie",
        mollie_subscription_id: mollieSubId,
        billing_interval:       interval,
        current_period_start:   new Date().toISOString(),
        current_period_end:     periodEnd.toISOString(),
        updated_at:             new Date().toISOString(),
      }, { onConflict: "account_id" }),

      supabase.from("invoices").upsert({
        account_id:          accountId,
        provider:            "mollie",
        provider_invoice_id: payment.id,
        provider_payment_url: payment._links.checkout?.href ?? null,
        status:              "paid",
        subtotal_cents:      amountCents,
        vat_rate:            21,
        vat_amount_cents:    Math.round(amountCents * 0.21 / 1.21),
        total_cents:         amountCents,
        currency:            "EUR",
        description:         `PostFlow ${plan.name} — ${interval}`,
        issued_at:           new Date().toISOString(),
        paid_at:             new Date().toISOString(),
      }, { onConflict: "provider,provider_invoice_id" }),
    ])

    return { accountId, tier, status: "active" }
  }

  if (payment.status === "failed" || payment.status === "expired") {
    await supabase.from("accounts").update({
      subscription_status: "past_due",
    }).eq("id", accountId)

    return { accountId, tier, status: "past_due" }
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMollieAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

function trialStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + TRIAL_DAYS)
  return d.toISOString().split("T")[0]
}
