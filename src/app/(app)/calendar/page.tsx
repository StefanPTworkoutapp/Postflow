import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { CalendarView } from "./CalendarView"

export default async function CalendarPage() {
  const supabase = await createClient()
  const brand = await getBrand()

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to   = new Date(year, month, 0).toISOString().split("T")[0]

  const { data: entries } = brand
    ? await supabase
        .from("content_calendar")
        .select("*, posts(id, caption, status, platform)")
        .eq("brand_id", brand.id)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("scheduled_date", { ascending: true })
    : { data: [] }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Your content schedule for the month.
        </p>
      </div>
      <Suspense>
        <CalendarView
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialEntries={(entries ?? []) as any}
          initialYear={year}
          initialMonth={month}
        />
      </Suspense>
    </div>
  )
}
