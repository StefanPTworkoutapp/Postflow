import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/** GET /api/calendar?year=2026&month=5 — returns all entries for the month */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ entries: [] })

    const { searchParams } = new URL(request.url)
    const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1))

    const from = `${year}-${String(month).padStart(2, "0")}-01`
    const to   = new Date(year, month, 0).toISOString().split("T")[0] // last day of month

    const { data: entries, error } = await supabase
      .from("content_calendar")
      .select("*, posts(id, caption, status, platform)")
      .eq("brand_id", brand.id)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ entries })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/calendar — update scheduled_date (drag-drop reschedule) */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand" }, { status: 400 })

    const { id, scheduled_date } = await request.json()
    if (!id || !scheduled_date) return NextResponse.json({ error: "id and scheduled_date required" }, { status: 400 })

    const { data, error } = await supabase
      .from("content_calendar")
      .update({ scheduled_date })
      .eq("id", id)
      .eq("brand_id", brand.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ entry: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
