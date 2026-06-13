"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Wand2,
  Palette,
  BarChart2,
  Settings,
  Zap,
  Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BrandSwitcher } from "./BrandSwitcher"

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href:  string
  icon:  React.ElementType
  /** If true, only match exact path (not prefix) */
  exact?: boolean
}

interface NavSection {
  heading: string
  items:   NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Create",
    items: [
      { label: "Home",     href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Schedule", href: "/schedule",  icon: CalendarDays },
      { label: "Create",   href: "/create",    icon: Wand2 },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      { label: "Brand",    href: "/brand",     icon: Palette },
      { label: "Insights", href: "/insights",  icon: BarChart2 },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Connect",  href: "/settings/connections", icon: Link2 },
      { label: "Settings", href: "/settings",             icon: Settings, exact: true },
    ],
  },
]

interface SidebarBrand {
  id:       string
  name:     string
  logo_url: string | null
}

interface SidebarProps {
  userEmail?:     string
  brands?:        SidebarBrand[]
  activeBrandId?: string
}

function NavLink({ label, href, icon: Icon, exact }: NavItem) {
  const pathname = usePathname()
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?")

  // Special case: /settings/connections should NOT activate /settings
  // This is handled by exact: true on /settings
  // And /settings/connections activates on startsWith("/settings/connections")

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
              : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-accent-foreground))]"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ userEmail: _userEmail, brands, activeBrandId }: SidebarProps) {
  const hasBrands = !!brands && brands.length > 0 && !!activeBrandId
  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shrink-0">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-[hsl(var(--sidebar-border))]">
        <Zap className="h-5 w-5 text-[var(--pf-teal)] shrink-0" />
        <span className="font-semibold text-sm tracking-tight">PostFlow</span>
      </div>

      {/* Brand switcher */}
      {hasBrands && (
        <div className="border-b border-[hsl(var(--sidebar-border))]">
          <BrandSwitcher brands={brands!} activeBrandId={activeBrandId!} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            {/* Section header */}
            <p className="text-[10px] font-semibold tracking-widest text-[hsl(var(--sidebar-foreground))]/30 px-3 pt-4 pb-1 uppercase">
              {section.heading}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}

      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] px-3 py-3">
        <p className="text-xs text-[hsl(var(--sidebar-foreground))]/30 truncate">PostFlow v1</p>
      </div>
    </aside>
  )
}
