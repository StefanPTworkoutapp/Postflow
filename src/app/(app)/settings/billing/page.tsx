/**
 * /settings/billing — Subscription management page.
 *
 * Shows:
 *   - Current plan + status
 *   - Pricing cards for all tiers (upgrade / downgrade CTAs)
 *   - Invoice history
 *   - Manage subscription button (Stripe portal)
 */

import { createClient } from "@/lib/supabase/server"
import { PLANS, getLimits, formatPrice, type PlanTier } from "@/lib/server/billing/plans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle2, CreditCard, FileText, HardDrive, Plus, Zap } from "lucide-react"
import { BillingActions } from "./BillingActions"
import { StorageAddonSection } from "./StorageAddonSection"
import { RenderCreditSection }  from "./RenderCreditSection"
import { getRenderCreditBalance } from "@/lib/server/billing/renderCredits"

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: account }, { data: invoices }, { data: userBrands }, { data: subRow }] = await Promise.all([
    supabase
      .from("accounts")
      .select("subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, mollie_customer_id")
      .eq("id", user.id)
      .single(),

    supabase
      .from("invoices")
      .select("id, provider, status, total_cents, currency, description, issued_at, paid_at, invoice_pdf_url, provider_payment_url")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),

    supabase
      .from("brands")
      .select("id")
      .eq("account_id", user.id),

    supabase
      .from("subscriptions")
      .select("storage_addon_gb")
      .eq("account_id", user.id)
      .maybeSingle(),
  ])

  const tier   = (account?.subscription_tier ?? "free") as PlanTier
  const status = account?.subscription_status ?? "active"
  const plan   = PLANS[tier]
  const limits = getLimits(tier)

  // Storage usage — sum across all brands
  const brandIds = (userBrands ?? []).map(b => b.id)
  let usedStorageMb = 0
  if (brandIds.length > 0) {
    const { data: uploads } = await supabase
      .from("media_uploads")
      .select("file_size_mb")
      .in("brand_id", brandIds)
    usedStorageMb = (uploads ?? []).reduce(
      (sum, row) => sum + (typeof row.file_size_mb === "number" ? row.file_size_mb : 0),
      0,
    )
  }
  const storageAddonGb  = subRow?.storage_addon_gb ?? 0
  const totalStorageGb  = limits.storageGb + storageAddonGb
  const storageLimitMb  = totalStorageGb * 1024
  const storagePercent  = storageLimitMb > 0 ? Math.min(100, (usedStorageMb / storageLimitMb) * 100) : 0
  const usedStorageGb   = (usedStorageMb / 1024).toFixed(2)

  const isTrialing     = status === "trialing"
  const isPastDue      = status === "past_due"
  const trialEndsAt    = account?.trial_ends_at
    ? new Date(account.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
    : null

  const hasStripe       = !!account?.stripe_customer_id
  const hasMollie       = !!account?.mollie_customer_id
  const renderBalance   = await getRenderCreditBalance(user.id)

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription, upgrade your plan, and view invoices.
        </p>
      </div>

      {/* Status banner */}
      {isPastDue && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <strong>Payment failed.</strong> Your last payment couldn't be processed. Please update your payment method to avoid losing access.
        </div>
      )}
      {isTrialing && trialEndsAt && (
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-400">
          You're on a free trial. Your trial ends on <strong>{trialEndsAt}</strong>. No charge until then.
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-500" />
            Current plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{plan.name}</span>
                <StatusBadge status={status} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {tier === "free"
                  ? "5 posts/month · 1 brand · Basic analytics"
                  : tier === "starter"
                  ? "Unlimited posts · 1 brand · Buffer + Analytics"
                  : tier === "pro"
                  ? "Unlimited posts · 3 brands · Advanced analytics"
                  : "Unlimited posts · 10 brands · Advanced analytics"}
              </p>
            </div>
            {(hasStripe || hasMollie) && tier !== "free" && (
              <BillingActions hasMollie={hasMollie} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Storage usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {usedStorageGb} GB of {totalStorageGb} GB used
              {storageAddonGb > 0 && (
                <span className="ml-1 text-xs text-indigo-500">
                  ({limits.storageGb} GB plan + {storageAddonGb} GB add-on)
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {storagePercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                storagePercent >= 90 ? "bg-red-500" :
                storagePercent >= 70 ? "bg-amber-500" :
                "bg-indigo-500"
              )}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          {storagePercent >= 90 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              You&apos;re almost out of storage. Upgrade your plan, add storage below, or delete unused media.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Storage add-on — only for paid plans */}
      {tier !== "free" && (
        <StorageAddonSection
          tier={tier}
          hasStripe={hasStripe}
          currentAddonGb={storageAddonGb}
        />
      )}

      {/* Render credits */}
      <RenderCreditSection balance={renderBalance} />

      {/* Pricing cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Choose a plan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["starter", "pro", "business"] as PlanTier[]).map(t => {
            const p        = PLANS[t]
            const isCurrent = t === tier
            return (
              <Card
                key={t}
                className={cn(
                  "relative",
                  isCurrent && "border-indigo-500 shadow-sm",
                  p.highlight && !isCurrent && "border-indigo-200 dark:border-indigo-800"
                )}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-500 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                      {p.highlight}
                    </span>
                  </div>
                )}
                <CardContent className="pt-6 pb-5">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <div className="mt-1 mb-4">
                    <span className="text-2xl font-bold">{formatPrice(p.monthlyEurCents)}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                    {p.annualEurCents < p.monthlyEurCents && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPrice(p.annualEurCents)}/mo billed annually
                      </p>
                    )}
                  </div>
                  <PlanFeatureList tier={t} />
                  <BillingActions
                    hasMollie={hasMollie}
                    targetTier={t}
                    currentTier={tier}
                    isCurrent={isCurrent}
                    variant="card"
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          All prices include 21% Dutch VAT. 14-day free trial on all paid plans. Cancel anytime.
        </p>
      </div>

      {/* Invoice history */}
      {(invoices ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Invoice history
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pl-6 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-right py-2 pr-6 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(invoices ?? []).map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pl-6 text-muted-foreground">
                      {inv.issued_at
                        ? new Date(inv.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-3 text-foreground/80">
                      {inv.description ?? `PostFlow ${tier}`}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {formatPrice(inv.total_cents)}
                    </td>
                    <td className="py-3 pr-6 text-right">
                      {inv.invoice_pdf_url ? (
                        <a
                          href={inv.invoice_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:underline text-xs"
                        >
                          PDF
                        </a>
                      ) : inv.status === "paid" ? (
                        <span className="text-green-600 text-xs font-medium">Paid</span>
                      ) : (
                        <span className="text-muted-foreground text-xs capitalize">{inv.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Payment methods note */}
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <CreditCard className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          We accept all major cards via Stripe, and iDEAL/SEPA via Mollie for Dutch customers.
          {hasStripe && " Your subscription is managed through Stripe — click \"Manage subscription\" to update payment methods or cancel."}
        </p>
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "active")   return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0 text-xs">Active</Badge>
  if (status === "trialing") return <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-0 text-xs">Trial</Badge>
  if (status === "past_due") return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">Past due</Badge>
  if (status === "canceled") return <Badge variant="secondary" className="text-xs">Canceled</Badge>
  return null
}

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  free:     ["5 posts/month", "1 brand", "Basic analytics"],
  starter:  ["Unlimited posts", "1 brand", "Buffer scheduling", "Standard analytics", "Weekly trend email"],
  pro:      ["Everything in Starter", "3 brands", "3 team members", "Advanced analytics"],
  studio:   ["Everything in Pro", "5 brands", "5 team members", "100 GB storage"],
  business: ["Everything in Studio", "10 brands", "10 team members", "Priority support"],
  agency:   ["Everything in Business", "Unlimited brands", "20 team members", "500 GB storage"],
}

function PlanFeatureList({ tier }: { tier: PlanTier }) {
  return (
    <ul className="space-y-1.5 mb-5">
      {PLAN_FEATURES[tier].map(f => (
        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          {f}
        </li>
      ))}
    </ul>
  )
}
