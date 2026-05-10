/**
 * Stripe billing helpers — compatible with Stripe v22 (dahlia).
 *
 * API changes in v22 relevant here:
 *  - Subscription no longer exposes current_period_start/end at the top level;
 *    they live on each SubscriptionItem (items.data[0].current_period_start/end)
 *  - Invoice.subscription is now Invoice.parent.subscription_details.subscription
 *  - Invoice.tax is now Invoice.total_taxes[0].amount (or sum)
 *
 * Lazy-init: getStripe() avoids build-time errors if STRIPE_SECRET_KEY is absent.
 */

import Stripe from "stripe"
import { PLANS, TRIAL_DAYS, type PlanTier, type BillingInterval } from "./plans"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
    })
  }
  return _stripe
}

export function stripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET!
}

/**
 * Creates or retrieves a Stripe customer for the given account.
 */
export async function getOrCreateStripeCustomer(opts: {
  accountId: string
  email:     string
  name?:     string
}): Promise<string> {
  const stripe   = getStripe()
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()

  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", opts.accountId)
    .single()

  if (account?.stripe_customer_id) return account.stripe_customer_id

  const customer = await stripe.customers.create({
    email:    opts.email,
    name:     opts.name ?? undefined,
    metadata: { postflow_account_id: opts.accountId },
  })

  await supabase
    .from("accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", opts.accountId)

  return customer.id
}

/**
 * Creates a Stripe Checkout Session for a plan upgrade.
 * Returns the session URL to redirect the user to.
 */
export async function createStripeCheckoutSession(opts: {
  accountId:   string
  email:       string
  name?:       string
  tier:        PlanTier
  interval:    BillingInterval
  successUrl:  string
  cancelUrl:   string
  withTrial?:  boolean
}): Promise<string> {
  const stripe  = getStripe()
  const plan    = PLANS[opts.tier]
  const priceId = opts.interval === "annual"
    ? plan.stripePriceAnnual
    : plan.stripePriceMonthly

  if (!priceId) throw new Error(`No Stripe price ID configured for ${opts.tier} ${opts.interval}`)

  const customerId = await getOrCreateStripeCustomer({
    accountId: opts.accountId,
    email:     opts.email,
    name:      opts.name,
  })

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        "subscription",
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url:  opts.cancelUrl,
    subscription_data: {
      metadata:            { postflow_account_id: opts.accountId, plan: opts.tier },
      trial_period_days:   opts.withTrial ? TRIAL_DAYS : undefined,
    },
    billing_address_collection: "auto",
    tax_id_collection:          { enabled: true },
    automatic_tax:              { enabled: true },
  })

  return session.url!
}

/**
 * Creates a Stripe Customer Portal session.
 */
export async function createStripePortalSession(opts: {
  stripeCustomerId: string
  returnUrl:        string
}): Promise<string> {
  const stripe  = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer:   opts.stripeCustomerId,
    return_url: opts.returnUrl,
  })
  return session.url
}

/**
 * Handles incoming Stripe webhook events.
 * Returns the updated account tier + status, or null if the event is irrelevant.
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string,
): Promise<{ accountId: string; tier: string; status: string; subscriptionId?: string } | null> {
  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret())
  } catch {
    throw new Error("Invalid Stripe webhook signature")
  }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()

  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== "subscription") return null

      const accountId = session.metadata?.postflow_account_id
      const tier      = session.metadata?.plan ?? "starter"
      if (!accountId) return null

      const sub    = await stripe.subscriptions.retrieve(session.subscription as string)
      const status = sub.status === "trialing" ? "trialing" : "active"

      // Period dates from first item (v22 places them on SubscriptionItem)
      const item           = sub.items.data[0]
      const periodStart    = item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : new Date().toISOString()
      const periodEnd      = item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null

      await Promise.all([
        supabase.from("accounts").update({
          subscription_tier:   tier,
          subscription_status: status,
          trial_ends_at:       sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        }).eq("id", accountId),

        supabase.from("subscriptions").upsert({
          account_id:             accountId,
          plan:                   tier,
          status,
          provider:               "stripe",
          stripe_subscription_id: sub.id,
          billing_interval:       sub.items.data[0]?.plan?.interval === "year" ? "annual" : "monthly",
          current_period_start:   periodStart,
          current_period_end:     periodEnd,
          trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          updated_at:             new Date().toISOString(),
        }, { onConflict: "account_id" }),
      ])

      return { accountId, tier, status, subscriptionId: sub.id }
    }

    case "customer.subscription.updated": {
      const sub       = event.data.object as Stripe.Subscription
      const accountId = sub.metadata?.postflow_account_id
      if (!accountId) return null

      const tier   = sub.metadata?.plan ?? "starter"
      const status = mapStripeStatus(sub.status)

      const item        = sub.items.data[0]
      const periodStart = item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : new Date().toISOString()
      const periodEnd   = item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null

      await Promise.all([
        supabase.from("accounts").update({
          subscription_tier:   tier,
          subscription_status: status,
        }).eq("id", accountId),

        supabase.from("subscriptions").upsert({
          account_id:             accountId,
          plan:                   tier,
          status,
          provider:               "stripe",
          stripe_subscription_id: sub.id,
          billing_interval:       sub.items.data[0]?.plan?.interval === "year" ? "annual" : "monthly",
          current_period_start:   periodStart,
          current_period_end:     periodEnd,
          canceled_at:            sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          updated_at:             new Date().toISOString(),
        }, { onConflict: "account_id" }),
      ])

      return { accountId, tier, status, subscriptionId: sub.id }
    }

    case "customer.subscription.deleted": {
      const sub       = event.data.object as Stripe.Subscription
      const accountId = sub.metadata?.postflow_account_id
      if (!accountId) return null

      await Promise.all([
        supabase.from("accounts").update({
          subscription_tier:   "free",
          subscription_status: "canceled",
        }).eq("id", accountId),

        supabase.from("subscriptions").upsert({
          account_id:             accountId,
          plan:                   "free",
          status:                 "canceled",
          provider:               "stripe",
          stripe_subscription_id: sub.id,
          canceled_at:            new Date().toISOString(),
          updated_at:             new Date().toISOString(),
        }, { onConflict: "account_id" }),
      ])

      return { accountId, tier: "free", status: "canceled" }
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice

      // v22: subscription ID lives on parent.subscription_details.subscription
      const subId = resolveInvoiceSubscriptionId(inv)
      let accountId: string | null = null

      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId)
        accountId = sub.metadata?.postflow_account_id ?? null
      }
      if (!accountId) return null

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("account_id", accountId)
        .single()

      // v22: taxes are in total_taxes array
      const vatAmount = inv.total_taxes
        ? inv.total_taxes.reduce((sum, t) => sum + (t.amount ?? 0), 0)
        : 0

      await supabase.from("invoices").upsert({
        account_id:          accountId,
        subscription_id:     subRow?.id ?? null,
        provider:            "stripe",
        provider_invoice_id: inv.id!,
        invoice_pdf_url:     inv.invoice_pdf ?? null,
        status:              "paid",
        subtotal_cents:      inv.subtotal,
        vat_amount_cents:    vatAmount,
        total_cents:         inv.total,
        currency:            inv.currency.toUpperCase(),
        description:         inv.lines.data[0]?.description ?? null,
        issued_at:           inv.created ? new Date(inv.created * 1000).toISOString() : null,
        paid_at:             inv.status_transitions?.paid_at
                               ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
                               : new Date().toISOString(),
      }, { onConflict: "provider,provider_invoice_id" })

      return null
    }

    case "invoice.payment_failed": {
      const inv     = event.data.object as Stripe.Invoice
      const subId   = resolveInvoiceSubscriptionId(inv)
      if (!subId) return null

      const sub       = await stripe.subscriptions.retrieve(subId)
      const accountId = sub.metadata?.postflow_account_id
      if (!accountId) return null

      await supabase.from("accounts").update({
        subscription_status: "past_due",
      }).eq("id", accountId)

      return { accountId, tier: "current", status: "past_due" }
    }

    default:
      return null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":   return "active"
    case "trialing": return "trialing"
    case "past_due": return "past_due"
    case "canceled": return "canceled"
    case "paused":   return "paused"
    default:         return "active"
  }
}

/**
 * In Stripe v22 (dahlia), Invoice.subscription was moved to
 * Invoice.parent.subscription_details.subscription.
 */
function resolveInvoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const parent = inv.parent
  if (!parent) return null
  if (parent.type !== "subscription_details") return null
  const subRef = parent.subscription_details?.subscription
  if (!subRef) return null
  return typeof subRef === "string" ? subRef : subRef.id
}
