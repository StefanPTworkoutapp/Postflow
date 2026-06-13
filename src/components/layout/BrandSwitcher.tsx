"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface BrandLite {
  id:       string
  name:     string
  logo_url: string | null
}

interface Props {
  brands:        BrandLite[]
  activeBrandId: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function Avatar({ brand, size = 24 }: { brand: BrandLite; size?: number }) {
  if (brand.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logo_url}
        alt={brand.name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--pf-teal)] text-white text-[10px] font-semibold"
      style={{ width: size, height: size }}
    >
      {initials(brand.name)}
    </span>
  )
}

export function BrandSwitcher({ brands, activeBrandId }: Props) {
  const router = useRouter()
  const [switching, setSwitching] = useState<string | null>(null)

  const active = brands.find((b) => b.id === activeBrandId) ?? brands[0]
  if (!active) return null

  async function switchTo(brandId: string) {
    if (brandId === activeBrandId) return
    setSwitching(brandId)
    try {
      const res = await fetch("/api/brands/active", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId }),
      })
      if (res.ok) {
        // Full reload so all server components re-read the cookie.
        window.location.reload()
      } else {
        setSwitching(null)
      }
    } catch {
      setSwitching(null)
    }
  }

  return (
    <div className="px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm",
            "bg-[hsl(var(--sidebar-accent))]/40 text-[hsl(var(--sidebar-foreground))]",
            "hover:bg-[hsl(var(--sidebar-accent))] transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          )}
          aria-label="Switch brand"
        >
          <Avatar brand={active} size={24} />
          <span className="flex-1 truncate text-left font-medium">{active.name}</span>
          {switching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 opacity-70" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="w-[--radix-dropdown-menu-trigger-width] min-w-[220px]"
        >
          {brands.map((brand) => {
            const isActive = brand.id === activeBrandId
            const isLoading = switching === brand.id
            return (
              <DropdownMenuItem
                key={brand.id}
                onSelect={(e) => {
                  e.preventDefault()
                  void switchTo(brand.id)
                }}
                className="gap-2"
              >
                <Avatar brand={brand} size={20} />
                <span className="flex-1 truncate">{brand.name}</span>
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
                ) : isActive ? (
                  <Check className="h-3.5 w-3.5 text-[var(--pf-teal)]" />
                ) : null}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              router.push("/brands/new")
            }}
            className="gap-2"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[hsl(var(--border))]">
              <Plus className="h-3 w-3" />
            </span>
            <span className="flex-1">Add brand</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
