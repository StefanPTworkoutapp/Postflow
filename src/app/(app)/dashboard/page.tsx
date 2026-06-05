import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WeeklyIdeas } from "@/components/dashboard/WeeklyIdeas"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  Upload,
  ImageIcon,
  Video,
} from "lucide-react"

export const metadata: Metadata = { title: "PostFlow · Home" }

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸",
  linkedin:  "💼",
  facebook:  "👥",
  tiktok:    "🎵",
  x:         "✖",
  threads:   "🧵",
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planned:       { label: "Planned",       className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  media_pending: { label: "Needs media",   className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  drafting:      { label: "Draft",         className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  ready:         { label: "Ready",         className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  scheduled:     { label: "Scheduled",     className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" },
  posted:        { label: "Posted",        className: "bg-indigo-200 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-300" },
  archived:      { label: "Archived",      className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500" },
}

export default async function DashboardPage() {
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const brand      = await getBrand()
  const firstName  = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "there"

  // ── Real data queries (only if brand exists) ──────────────────────────────
  const now        = new Date()
  const todayStr   = now.toISOString().split("T")[0]
  const weekEnd    = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split("T")[0]
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

  const [
    { count: readyCount    },
    { count: scheduledCount},
    { count: postedCount   },
    { count: mediaCount    },
    { data:  upcomingPosts },
    { data:  actionItems   },
  ] = brand
    ? await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true })
          .eq("brand_id", brand.id).eq("status", "ready"),
        supabase.from("posts").select("*", { count: "exact", head: true })
          .eq("brand_id", brand.id).eq("status", "scheduled"),
        supabase.from("content_calendar").select("*", { count: "exact", head: true })
          .eq("brand_id", brand.id).eq("status", "posted")
          .gte("scheduled_date", monthStart),
        supabase.from("media_uploads").select("*", { count: "exact", head: true })
          .eq("brand_id", brand.id),
        // Upcoming posts this week
        supabase.from("content_calendar")
          .select("id, scheduled_date, topic, platforms, status, content_pillar, posts(id)")
          .eq("brand_id", brand.id)
          .gte("scheduled_date", todayStr)
          .lte("scheduled_date", weekEndStr)
          .order("scheduled_date", { ascending: true })
          .limit(6),
        // Action items: planned entries with no topic, or media_pending
        supabase.from("content_calendar")
          .select("id, scheduled_date, topic, platforms, status, posts(id)")
          .eq("brand_id", brand.id)
          .in("status", ["media_pending", "planned"])
          .gte("scheduled_date", todayStr)
          .order("scheduled_date", { ascending: true })
          .limit(5),
      ])
    : [
        { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 },
        { data: [] }, { data: [] },
      ]

  // ── Setup checklist (dynamic) ─────────────────────────────────────────────
  const hasBrand      = !!brand?.name
  const hasMedia      = (mediaCount ?? 0) > 0
  const hasPost       = (readyCount ?? 0) + (scheduledCount ?? 0) + (postedCount ?? 0) > 0
  const allDone       = hasBrand && hasMedia && hasPost
  const setupSteps = [
    {
      title:       "Set up your brand",
      description: "Add your logo, tone of voice, and goals",
      href:        "/brand",
      done:        hasBrand,
    },
    {
      title:       "Upload your first media",
      description: "Photos and videos for this month's posts",
      href:        "/upload",
      done:        hasMedia,
    },
    {
      title:       "Generate your first post",
      description: "AI writes the caption from your brand voice",
      href:        "/posts/new",
      done:        hasPost,
    },
    {
      title:       "Connect Buffer",
      description: "Auto-schedule to LinkedIn, Facebook, and more",
      href:        "/settings",
      done:        false,
    },
  ]

  // ── Calibration due banner ──────────────────────────────────────────────
  const calibrationDue = brand?.calibration_status === "due"

  return (
    <div className="space-y-6">
      {/* Recalibration banner — shown when brand data is stale or health is low */}
      {calibrationDue && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Time to update your brand calibration
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                PostFlow has detected that your brand profile may be outdated — either because
                it&apos;s been a while since calibration, or performance has dropped on multiple
                platforms. Re-run calibration to keep AI output aligned with your current brand and audience.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
              <Link href="/onboarding">Re-calibrate →</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Here&apos;s what&apos;s happening with your content this week.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/posts/new">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New post
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Ready to post"
          value={String(readyCount ?? 0)}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          description="Posts approved and ready"
          href="/posts?status=ready"
        />
        <StatCard
          title="Scheduled"
          value={String(scheduledCount ?? 0)}
          icon={<Clock className="h-4 w-4 text-purple-500" />}
          description="Queued via Buffer"
          href="/posts?status=scheduled"
        />
        <StatCard
          title="Posted this month"
          value={String(postedCount ?? 0)}
          icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
          description="Published across platforms"
          href="/schedule?tab=calendar"
        />
      </div>

      {/* Weekly ideas widget — client component, uses localStorage cache */}
      {brand && <WeeklyIdeas brandId={brand.id} />}

      {/* Action items + Upcoming posts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Action items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Action items
              </CardTitle>
              {(actionItems?.length ?? 0) > 0 && (
                <Link href="/schedule?tab=calendar" className="text-xs text-indigo-500 hover:underline">
                  View all
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(actionItems?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8 text-[hsl(var(--muted-foreground))]/30" />}
                message="You're all caught up! No actions needed."
              />
            ) : (
              <ul className="space-y-1">
                {actionItems!.map(entry => {
                  const cfg    = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.planned
                  const postId = (entry.posts as Array<{ id: string }> | null)?.[0]?.id
                  const href   = postId ? `/posts/${postId}` : `/schedule?tab=calendar&open=${entry.id}`
                  return (
                    <li key={entry.id}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))]/60 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {entry.topic ?? "Untitled post"}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {entry.scheduled_date}
                            {(entry.platforms ?? []).length > 0 && (
                              <> · {(entry.platforms as string[]).map(p => PLATFORM_EMOJI[p] ?? p).join(" ")}</>
                            )}
                          </p>
                        </div>
                        <span className={cn("shrink-0 text-xs px-2 py-0.5 rounded-full font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming posts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                Upcoming this week
              </CardTitle>
              <Link href="/schedule?tab=calendar" className="text-xs text-indigo-500 hover:underline">
                Open calendar
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {(upcomingPosts?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-8 w-8 text-[hsl(var(--muted-foreground))]/30" />}
                message={
                  brand
                    ? "No posts scheduled this week. Create one to get started."
                    : "Complete your brand setup to start scheduling posts."
                }
              />
            ) : (
              <ul className="space-y-1">
                {upcomingPosts!.map(entry => {
                  const cfg    = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.planned
                  const postId = (entry.posts as Array<{ id: string }> | null)?.[0]?.id
                  const href   = postId ? `/posts/${postId}` : `/schedule?tab=calendar&open=${entry.id}`
                  return (
                    <li key={entry.id}>
                      <Link
                        href={href}
                        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))]/60 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {entry.topic ?? "Untitled post"}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {formatDate(entry.scheduled_date)}
                            {(entry.platforms ?? []).length > 0 && (
                              <> · {(entry.platforms as string[]).map(p => PLATFORM_EMOJI[p] ?? p).join(" ")}</>
                            )}
                          </p>
                        </div>
                        <span className={cn("shrink-0 text-xs px-2 py-0.5 rounded-full font-medium", cfg.className)}>
                          {cfg.label}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Setup checklist — hidden once everything is done */}
      {!allDone && (
        <Card className="border-dashed border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Get started with PostFlow</CardTitle>
              <Link
                href="/onboarding"
                className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
              >
                Redo setup
              </Link>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Complete these steps to generate your first post.
            </p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {setupSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium",
                    step.done
                      ? "border-green-500 bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                      : "border-[hsl(var(--muted-foreground))]/30 text-[hsl(var(--muted-foreground))]"
                  )}>
                    {step.done ? "✓" : i + 1}
                  </span>
                  <div className="flex-1">
                    <Link href={step.href} className={cn(
                      "text-sm font-medium hover:underline",
                      step.done && "line-through text-[hsl(var(--muted-foreground))]"
                    )}>
                      {step.title}
                    </Link>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{step.description}</p>
                  </div>
                  <Badge variant={step.done ? "default" : "secondary"} className={cn(
                    "ml-auto shrink-0 text-xs",
                    step.done && "bg-green-500 hover:bg-green-500"
                  )}>
                    {step.done ? "Done" : "Pending"}
                  </Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function StatCard({
  title,
  value,
  icon,
  description,
  href,
}: {
  title:       string
  value:       string
  icon:        React.ReactNode
  description: string
  href:        string
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            {title}
          </CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
      {icon}
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
    </div>
  )
}
