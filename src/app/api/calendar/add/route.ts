import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * GET /api/calendar/add?token=<jwt>
 *
 * Magic-link endpoint from the weekly trend email.
 * Verifies the signed JWT, creates a calendar entry for the suggested topic,
 * then redirects the user to the calendar page.
 *
 * JWT payload: { brandId: string, topic: string, action: "add_calendar" }
 * Signed with CALENDAR_LINK_SECRET (HS256), expires in 7 days.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/calendar", request.url))
  }

  // Verify JWT
  const secret = new TextEncoder().encode(
    process.env.CALENDAR_LINK_SECRET ?? "fallback-secret-change-in-production"
  )

  let brandId: string
  let topic: string

  try {
    const { payload } = await jwtVerify(token, secret)
    brandId = payload.brandId as string
    topic   = payload.topic   as string
    if (payload.action !== "add_calendar") throw new Error("wrong action")
  } catch {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Schedule the entry for next week on the first available weekday
  const date = new Date()
  date.setDate(date.getDate() + (8 - date.getDay()) % 7 + 1)  // next Monday
  const scheduledDate = date.toISOString().split("T")[0]

  const { error } = await supabase
    .from("content_calendar")
    .insert({
      brand_id:            brandId,
      scheduled_date:      scheduledDate,
      topic,
      content_pillar:      "education",
      goal:                "engagement",
      required_media_type: "photo",
      required_media_count: 1,
      status:              "planned",
      // Source note so user knows this came from the trend email
      media_brief:         `Added from weekly trend brief. Suggested topic: ${topic}`,
    })

  if (error) {
    console.error("[calendar/add] insert error:", error.message)
    // Redirect anyway — better UX than error page
  }

  // Redirect to the calendar — user will see the new entry
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  return NextResponse.redirect(`${appUrl}/calendar`)
}
