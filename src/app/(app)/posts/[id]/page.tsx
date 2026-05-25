import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getOptimalScheduleTime, formatOptimalTime, nextOccurrenceDate } from "@/lib/server/scheduling/optimal-time"
import { PostEditor, type TemplateHealthMap } from "./PostEditor"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const brand = await getBrand()

  if (!brand) redirect("/onboarding")

  const { data: post, error } = await supabase
    .from("posts")
    .select("*, content_calendar(id, scheduled_date, topic, content_pillar, media_brief, required_media_type, media_urls)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .single()

  if (error || !post) notFound()

  const cal = post.content_calendar as {
    id?: string
    scheduled_date?: string
    topic?: string
    content_pillar?: string
    media_brief?: string | null
    required_media_type?: string | null
    media_urls?: string[] | null
  } | null

  // Load optimal schedule time for the post's platform
  const optimalTime  = await getOptimalScheduleTime(brand.id, post.platform)
  const optimalLabel = formatOptimalTime(optimalTime)
  const optimalDate  = nextOccurrenceDate(optimalTime)

  // Load template health scores for this brand + platform (for template picker badges)
  const { data: templateHealthRows } = await createClient().then(sb =>
    sb
      .from("template_health")
      .select("template_slug, health_score, trend, posts_count")
      .eq("brand_id", brand.id)
      .eq("platform", post.platform)
  )
  const templateHealth: TemplateHealthMap = Object.fromEntries(
    (templateHealthRows ?? []).map(r => [r.template_slug, {
      health_score: r.health_score,
      trend:        r.trend,
      posts_count:  r.posts_count,
    }])
  )

  return (
    <div className="space-y-6">
      <PostEditor
        post={{
          id:               post.id,
          platform:         post.platform,
          caption:          post.caption ?? "",
          hashtags:         (post.hashtags as string[]) ?? [],
          cta:              post.cta ?? null,
          status:           post.status,
          media_ids:        (post.media_ids as string[]) ?? [],
          template_slug:        post.template_slug ?? null,
          slide_content:        (post.slide_content as any) ?? null,
          carousel_image_urls:    (post.carousel_image_urls as string[] | null) ?? null,
          client_approval_status: post.client_approval_status as "pending" | "approved" | "flagged" | null ?? null,
          content_calendar:       cal,
        }}
        brandName={brand.name}
        industry={brand.industry ?? ""}
        contentLanguage={(brand as unknown as { content_language?: string | null }).content_language ?? "en"}
        optimalTime={{ label: optimalLabel, date: optimalDate, confidence: optimalTime.confidence }}
        templateHealth={templateHealth}
      />
    </div>
  )
}
