# Spec: Multi-Template Preferences per Post Type

**Status:** Not built
**Phase:** H5
**Priority:** High — prevents bot-look by rotating varied designs

---

## Problem

Every brand currently uses the same template every time for a given post type.
Posting 30 carousels with carousel-edu looks robotic. Brands need 2–5 saved
template slots per post type that rotate automatically, with the option to lock
a favourite from being auto-swapped by the analytics engine.

---

## Template slot limits by plan

| Plan     | Templates per post type | Lock feature |
|----------|------------------------|--------------|
| Free     | 1                      | No           |
| Starter  | 1                      | No           |
| Pro      | 3                      | Yes (1 lock) |
| Studio   | 5                      | Yes (2 locks)|
| Business | 5                      | Yes (2 locks)|
| Agency   | 5                      | Yes (3 locks)|

**Replacement rule when at capacity:**
- Replace the template with the lowest health score that is not locked
- If all slots are locked: prompt the user to unlock one before adding

---

## Post types

```
single_image | carousel | reel | story | quote | linkedin_text
```

---

## Schema

### New table: `postflow.brand_template_preferences`

```sql
CREATE TABLE postflow.brand_template_preferences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES postflow.brands(id) ON DELETE CASCADE,
  post_type       TEXT        NOT NULL,   -- single_image | carousel | reel | story | quote
  template_slug   TEXT        NOT NULL,   -- matches render template slugs
  slot_index      INTEGER     NOT NULL,   -- 0-based position in the rotation
  locked          BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, post_type, slot_index)
);

CREATE INDEX btp_brand_post_type_idx ON postflow.brand_template_preferences(brand_id, post_type);
ALTER TABLE postflow.brand_template_preferences ENABLE ROW LEVEL SECURITY;
```

---

## Rotation logic

Server-side in `/src/lib/server/render/selectTemplate.ts` (new file):

```
1. Query brand_template_preferences for brand_id + post_type, ORDER BY slot_index
2. If empty → fall back to getBestTemplate() (analytics auto-selection)
3. Pick the next slot using round-robin:
   - Track last_used_slot in localStorage (client) OR in a brand_token_events row
   - Advance slot_index modulo total slots
4. Return the template_slug for that slot
```

For the **simple session-level case**: pick the slot whose `slot_index = (total_published_posts % slot_count)`. No state needed — deterministic from post count.

---

## UI

### Brand template preferences panel

**Location:** `/brands/[id]/edit` → new "Templates" tab  
(Part of Phase H2 brand editor)

```
Templates for this brand
┌─ Single Image ──────────────────────────────────────┐
│  Slot 1: [edu-bold]     🔒 Locked    [Remove]       │
│  Slot 2: [dark-statement]            [Remove]       │
│  Slot 3: [photo-overlay]             [Remove]       │
│  [+ Add template] (disabled at max slots)           │
└─────────────────────────────────────────────────────┘
┌─ Carousel ──────────────────────────────────────────┐
│  Slot 1: [carousel-edu]              [Remove]       │
│  [+ Add template]                                   │
└─────────────────────────────────────────────────────┘
```

- Live preview renders the template with current brand tokens when hovering
- Lock icon available on Pro+ (toggle locks/unlocks)
- When Pro user tries to add 4th slot: "Upgrade to Studio for 5 templates per type"
- When system auto-swaps a slot: show toast "carousel-myth replaced edu-bold (low performance)"

### Template picker (in Post Editor)

When user is choosing a template in the create/edit flow:
- Show brand's preferred templates first, highlighted "Your style"
- Other templates below with "Other templates" divider
- Badge on each: health score + trend arrow

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/brands/[id]/template-preferences` | List all slots |
| POST | `/api/brands/[id]/template-preferences` | Add a slot |
| PATCH | `/api/brands/[id]/template-preferences/[slotId]` | Toggle lock |
| DELETE | `/api/brands/[id]/template-preferences/[slotId]` | Remove slot |

---

## Plans.ts update

Add `templateSlotsPerPostType` to `PlanLimits`:

```typescript
interface PlanLimits {
  // ... existing fields
  templateSlotsPerPostType: number   // 1 for free/starter, 3 for pro, 5 for studio+
  templateLockSlots:        number   // 0 for free/starter, 1 for pro, 2 for studio+
}
```

---

## Auto-swap behaviour

When `templatePulse` (runs every 6h) detects a slot has score < 40 and
a better alternative exists (+15 pts) AND the slot is not locked:
1. Update the slot to the better template
2. Insert a notification in a new `brand_notifications` table (or just log)
3. Send in-app bell notification if user is online (future: push notification)

---

## Acceptance criteria

- [ ] Migration creates `brand_template_preferences` table with RLS
- [ ] Plans.ts has `templateSlotsPerPostType` and `templateLockSlots`
- [ ] Brand editor shows Templates tab with per-post-type slots
- [ ] Lock toggle works on Pro+ (enforced server-side)
- [ ] Rotation logic selects templates round-robin from saved slots
- [ ] Post Editor shows brand's preferred templates at the top
- [ ] Auto-swap replaces lowest-score unlocked slot
- [ ] Upgrade prompt when at slot limit
