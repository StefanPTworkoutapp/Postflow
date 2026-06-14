import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Mic, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"

// Fetch brands with the extra fields the list page needs
async function getBrandsForList() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("brands")
    .select("id, name, logo_url, industry, primary_color, created_at")
    .eq("account_id", user.id)
    .order("created_at", { ascending: true })

  return data ?? []
}

function BrandAvatar({
  name,
  logoUrl,
  primaryColor,
}: {
  name: string
  logoUrl: string | null
  primaryColor: string | null
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className="h-10 w-10 rounded-xl object-contain border border-[hsl(var(--border))]"
      />
    )
  }

  return (
    <div
      className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold text-white shrink-0"
      style={{ backgroundColor: primaryColor ?? "#6366f1" }}
    >
      {initials}
    </div>
  )
}

export default async function BrandsPage() {
  const brands = await getBrandsForList()

  if (brands === null) redirect("/login")
  if (brands.length === 0) redirect("/onboarding")

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Brands</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {brands.length === 1
              ? "You have 1 brand"
              : `You have ${brands.length} brands`}
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/brands/new">
            <Plus className="h-4 w-4" />
            Add brand
          </Link>
        </Button>
      </div>

      {/* Brand list */}
      <div className="space-y-2">
        {brands.map((brand) => (
          <div
            key={brand.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3.5 hover:bg-[hsl(var(--muted))]/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <BrandAvatar
                name={brand.name ?? ""}
                logoUrl={brand.logo_url}
                primaryColor={(brand as unknown as { primary_color?: string }).primary_color ?? null}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{brand.name}</p>
                {(brand as unknown as { industry?: string }).industry && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                    {(brand as unknown as { industry?: string }).industry}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Link href={`/brand?tab=voice`}>
                  <Mic className="h-3.5 w-3.5" />
                  Manage voice
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Link href={`/brand?tab=identity`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Single-brand nudge */}
      {brands.length === 1 && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-5 text-center space-y-2">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Managing multiple clients or businesses?
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/brands/new">
              <Plus className="h-4 w-4" />
              Add a new brand
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
