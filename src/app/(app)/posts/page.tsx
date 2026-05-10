import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PlusCircle, FileText } from "lucide-react"

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

export default async function PostsPage() {
  const supabase = await createClient()
  const brand = await getBrand()

  const { data: posts } = brand
    ? await supabase
        .from("posts")
        .select("*, content_calendar(scheduled_date, topic, content_pillar)")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
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
            return (
              <Link key={post.id} href={`/posts/${post.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    {/* Platform icon */}
                    <span className="text-2xl mt-0.5 shrink-0">
                      {PLATFORM_EMOJI[post.platform] ?? "📄"}
                    </span>

                    {/* Main content */}
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
                    </div>

                    {/* Status badge */}
                    <Badge className={`shrink-0 text-xs border-0 ${STATUS_STYLES[post.status] ?? ""}`}>
                      {post.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
