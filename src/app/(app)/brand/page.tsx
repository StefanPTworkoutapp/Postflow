import { redirect } from "next/navigation"
import { getBrand } from "@/lib/server/brand/getBrand"
import { BrandEditor } from "./BrandEditor"

export default async function BrandPage() {
  const brand = await getBrand()

  if (!brand) redirect("/onboarding")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Edit your brand identity, voice, and audience.
        </p>
      </div>

      <BrandEditor brand={brand} />
    </div>
  )
}
