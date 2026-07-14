/**
 * /schedule — merged Calendar + Posts + Upload page
 *
 * Tab navigation via URL param: ?tab=calendar (default) | posts | upload
 * Brand filter via URL param: ?brand=all | ?brand=[id] (defaults to active brand)
 * Server component: reads searchParams, fetches data, renders the right content.
 */

import type { Metadata } from "next"
import Link               from "next/link"
import { createClient }   from "@/lib/supabase/server"
import { getActiveBrand }       from "@/lib/server/brand/getActiveBrand"
import { CalendarView }   from "../calendar/CalendarView"
import { CalendarOptimizationsSummary, type CalendarOptimization } from "../calendar/CalendarOptimizationsSummary"
import { ScheduleTabBar } from "./ScheduleTabBar"

// ── Posts tab imports (inlined from posts/page.tsx) ───────────────────────────
import { Card, CardContent } from "@/components/ui/card"
import { Badge }             from "@/components/ui/badge"
import { Button }            from "@/components/ui/button"
import { PlusCircle, FileText } from "lucide-react"

// ── Upload tab imports ────────────────────────────────────────────────────────
import { UploadTabContent } from "./UploadTabContent"
import { RetryPublishButton } from "./RetryPublishButton"

export const metadata: Metadata = { title: "PostFlow · Schedule" }

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  ready:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  posted:    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  failed:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸",
  linkedin:  "💼",
  facebook:  "👥",
  tiktok:    "🎵",
  x:         "✖",
  threads:   "🧵",
}

type Tab = "calendar" | "posts" | "upload"

/** Brand info used for filter chips and entry colour-coding */
interface BrandInfo {
  id:            string
  name:          string
  primary_color: string | null
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; brand?: string; open?: string }>
}) {
  const params      = await searchParams
  const activeTab   = (params.tab as Tab | undefined) ?? "calendar"
  const brandParam  = params.brand   // "all" | brand-id | undefined
  const openEntryId = params.open ?? null  // auto-open a specific calendar entry

  const supabase = await createClient()
  const brand    = await getActiveBrand()

  // ── Resolve user's brands list (needed for filter chips + "all" mode) ──────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: allBrands } = user
    ? await supabase
        .from("brands")
        .select("id, name, primary_color")
        .eq("account_id", user.id)
        .order("created_at", { ascending: true })
    : { data: [] as BrandInfo[] }

  const userBrands: BrandInfo[] = (allBrands ?? []) as BrandInfo[]
  const isMultiBrand  = userBrands.length >= 2
  const showAllBrands = brandParam === "all" && isMultiBrand

  // Resolve which brand ID(s) to query
  const activeBrandId = brandParam && brandParam !== "all"
    ? brandParam
    : brand?.id

  // ── Calendar data ──────────────────────────────────────────────────────────
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const from  = `${year}-${String(month).padStart(2, "0")}-01`
  const to    = new Date(year, month, 0).toISOString().split("T")[0]

  let calendarEntries: unknown[] = []

  if (showAllBrands && userBrands.length > 0) {
    const allBrandIds = userBrands.map(b => b.id)
    const { data } = await supabase
      .from("content_calendar")
      .select("*, posts(id, caption, status, platform), brands(id, name, primary_color)")
      .in("brand_id", allBrandIds)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date", { ascending: true })

    // Flatten brand colour onto each entry for CalendarView
    calendarEntries = (data ?? []).map(entry => ({
      ...entry,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      brand_color: (entry as any).brands?.primary_color ?? null,
    }))
  } else if (activeBrandId) {
    const { data } = await supabase
      .from("content_calendar")
      .select("*, posts(id, caption, status, platform)")
      .eq("brand_id", activeBrandId)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date", { ascending: true })

    calendarEntries = data ?? []
  }

  // ── Calendar optimizations (this week) ──────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // calendar_optimizations is not yet in generated database.types.ts pre-migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentOptimizations } = activeBrandId
    ? await (supabase as any)
        .from("calendar_optimizations")
        .select("id, entry_id, change_type, from_value, to_value, reason, created_at")
        .eq("brand_id", activeBrandId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
    : { data: [] }

  // ── Posts data ─────────────────────────────────────────────────────────────
  const { data: posts } = activeBrandId
    ? await supabase
        .from("posts")
        .select("*, content_calendar(scheduled_date, topic, content_pillar)")
        .eq("brand_id", activeBrandId)
        .order("created_at", { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Manage your content calendar, posts, and media library.
        </p>
      </div>

      {/* Tab bar */}
      <ScheduleTabBar activeTab={activeTab} />

      {/* Tab content */}
      {activeTab === "calendar" && (
        <div>
          {/* ── Brand filter chips (only for multi-brand users) ────────────── */}
          {isMultiBrand && (
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="?tab=calendar&brand=all"
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                  showAllBrands
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]",
                ].join(" ")}
              >
                All brands
              </Link>
              {userBrands.map(b => {
                const isActive = !showAllBrands && (activeBrandId === b.id)
                return (
                  <Link
                    key={b.id}
                    href={`?tab=calendar&brand=${b.id}`}
                    className={[
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300"
                        : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]",
                    ].join(" ")}
                  >
                    {b.primary_color && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: b.primary_color }}
                      />
                    )}
                    {b.name}
                  </Link>
                )
              })}
            </div>
          )}

          <CalendarOptimizationsSummary optimizations={(recentOptimizations ?? []) as CalendarOptimization[]} />

          <CalendarView
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialEntries={calendarEntries as any}
            initialYear={year}
            initialMonth={month}
            brandMode={showAllBrands ? "all" : "single"}
            brands={userBrands}
            initialOpenId={openEntryId}
          />
        </div>
      )}

      {activeTab === "posts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Posts</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                All your generated and scheduled posts.
              </p>
            </div>
            <Button asChild>
              <Link href="/posts/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                New post
              </Link>
            </Button>
          </div>

          {!posts?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <FileText className="h-10 w-10 text-[hsl(var(--muted-foreground))]/30" />
                <p className="text-sm font-medium">No posts yet</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Generate your first post to get started.
                </p>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/posts/new">Create post</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const cal = post.content_calendar as { scheduled_date?: string; topic?: string } | null
                // publish_error may not be selected in the generated types yet
                // (migration 20260714000001_posts_publish_error.sql pending) —
                // read it defensively.
                const publishError = (post as unknown as { publish_error?: string | null }).publish_error ?? null
                const isFailed = post.status === "failed"
                return (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start gap-4">
                        <Link href={`/posts/${post.id}`} className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer">
                          <span className="text-2xl mt-0.5 shrink-0">
                            {PLATFORM_EMOJI[post.platform] ?? "📄"}
                          </span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                                {post.platform}
                              </span>
                              {cal?.scheduled_date && (
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  · {new Date(cal.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                </span>
                              )}
                              {cal?.topic && (
                                <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                                  · {cal.topic}
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-snug line-clamp-2 text-foreground">
                              {post.caption ?? "No caption yet"}
                            </p>
                            {post.hashtags?.length ? (
                              <p className="text-xs text-indigo-500 truncate">
                                {(post.hashtags as string[]).slice(0, 6).map((h) => `#${h}`).join(" ")}
                                {post.hashtags.length > 6 && ` +${post.hashtags.length - 6}`}
                              </p>
                            ) : null}
                            {isFailed && publishError && (
                              <p className="text-xs text-red-600 dark:text-red-400 truncate">
                                ❌ {publishError}
                              </p>
                            )}
                          </div>
                        </Link>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge className={`shrink-0 text-xs border-0 ${STATUS_STYLES[post.status] ?? ""}`}>
                            {post.status}
                          </Badge>
                          {isFailed && <RetryPublishButton postId={post.id} />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "upload" && <UploadTabContent />}
    </div>
  )
}
