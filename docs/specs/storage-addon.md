# Spec: Storage Add-on (Separate from Plan Tier)

**Status:** Not built — decision pending
**Phase:** Post-H5 / billing v2
**Priority:** Medium — good upsell, avoids forcing full plan upgrades

---

## Recommendation: YES, build this

Forcing a €49→€99 plan upgrade just because someone ran out of storage is poor UX
and will cause churn. A €5–10/month storage add-on is standard SaaS practice
(Notion, Linear, Cloudflare) and gives an upsell path that doesn't feel punishing.

---

## Add-on options

| Add-on | Extra Storage | Price/month | Stripe product |
|--------|--------------|-------------|----------------|
| Storage S | +50 GB | €5 | `STRIPE_ADDON_STORAGE_50` |
| Storage M | +200 GB | €15 | `STRIPE_ADDON_STORAGE_200` |
| Storage L | +500 GB | €30 | `STRIPE_ADDON_STORAGE_500` |

Annual billing: 20% discount (same as plan prices).

Available on: Starter+. Free plan cannot add storage (must upgrade plan first).

---

## How it works technically

### Stripe
Add-ons are additional subscription items on the existing subscription:
```typescript
await stripe.subscriptionItems.create({
  subscription: existingSubId,
  price:        process.env.STRIPE_ADDON_STORAGE_50,
  quantity:     1,
})
```
Stripe prorates billing automatically.

### Database

New column on `subscriptions` table:
```sql
ALTER TABLE postflow.subscriptions
  ADD COLUMN storage_addon_gb INTEGER NOT NULL DEFAULT 0;
```

New webhook handler for `customer.subscription.updated`:
- When a subscription item with `metadata.type = "storage_addon"` is added/removed
- Update `subscriptions.storage_addon_gb` accordingly

### Storage limit calculation

In `checkStorageLimit()` (already in `limits.ts`):
```typescript
// Add addon storage to the base plan limit
const { data: sub } = await supabase
  .from("subscriptions")
  .select("storage_addon_gb")
  .eq("account_id", accountId)
  .single()

const totalLimitMb = (limits.storageGb + (sub?.storage_addon_gb ?? 0)) * 1024
```

---

## UI

### In `/settings/billing`

Add a new card below the existing plan cards:

```
┌─ Storage Add-on ────────────────────────────────────────────────┐
│  Currently using: 8.2 GB of 10 GB (base) + 0 GB (add-on)      │
│                                                                   │
│  [+50 GB — €5/mo]  [+200 GB — €15/mo]  [+500 GB — €30/mo]    │
│                                                                   │
│  Add storage without changing your plan. Cancel anytime.        │
└─────────────────────────────────────────────────────────────────┘
```

### In bell notification (when at 90%)

Add a second CTA button:
```
[Upgrade plan]   [Add +50 GB for €5]   [Dismiss]
```

---

## Bell notification update

When `storagePercent >= 90`, show a more actionable notification:
- "Almost out of storage" (not just "upgrade plan")
- Two options: upgrade plan OR add storage
- Clicking "Add storage" goes to `/settings/billing#storage-addon`

---

## Stripe products to create

Create in Stripe dashboard (live):
1. Product: "PostFlow Storage Add-on +50 GB"
   - Price monthly: €5.00 → env `STRIPE_ADDON_STORAGE_50_MONTHLY`
   - Price annual: €48.00 → env `STRIPE_ADDON_STORAGE_50_ANNUAL`
   - Metadata: `type=storage_addon`, `storage_gb=50`

2. Product: "PostFlow Storage Add-on +200 GB"
   - Price monthly: €15.00 → env `STRIPE_ADDON_STORAGE_200_MONTHLY`
   - etc.

3. Product: "PostFlow Storage Add-on +500 GB"
   - Price monthly: €30.00 → env `STRIPE_ADDON_STORAGE_500_MONTHLY`
   - etc.

---

## Acceptance criteria

- [ ] Stripe products + prices created in dashboard
- [ ] Env vars set for all add-on price IDs
- [ ] Migration adds `storage_addon_gb` to subscriptions
- [ ] `checkStorageLimit()` adds addon_gb to limit calculation
- [ ] Webhook handler updates `storage_addon_gb` on subscription changes
- [ ] Billing page shows storage add-on section
- [ ] Bell notification shows "Add +50 GB" option when at 90%
- [ ] Storage bar in billing reflects total (base + addon) limit
- [ ] Free plan cannot purchase add-on (server-side enforced)

---

## Build order

1. Create Stripe products (manual, 15 min)
2. Migration (5 min)
3. Update `checkStorageLimit()` (10 min)
4. Add webhook handler (20 min)
5. Billing page UI (30 min)
6. Update bell notification (15 min)

Total estimated: ~1.5h
