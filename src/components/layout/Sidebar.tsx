"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Upload,
  FileText,
  Clapperboard,
  BarChart2,
  Palette,
  Settings,
  Zap,
  Link2,
  LayoutTemplate,
  Wand2,
  TrendingUp,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Posts", href: "/posts", icon: FileText },
  { label: "Stories & Reels", href: "/stories", icon: Clapperboard },
  { label: "Create Video",    href: "/create",  icon: Wand2 },
  { label: "Trend Builder",  href: "/trend",   icon: TrendingUp },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Brand", href: "/brand", icon: Palette },
  { label: "Templates",    href: "/templates",   icon: LayoutTemplate },
  { label: "Inspiration",  href: "/inspiration", icon: Sparkles },
  { label: "Connections", href: "/settings/connections", icon: Link2 },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shrink-0">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-[hsl(var(--sidebar-border))]">
        <Zap className="h-5 w-5 text-indigo-400 shrink-0" />
        <span className="font-semibold text-sm tracking-tight">PostFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Tooltip key={href} delayDuration={300}>
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
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] px-3 py-3">
        <p className="text-xs text-[hsl(var(--sidebar-foreground))]/40 truncate">PostFlow MVP</p>
      </div>
    </aside>
  )
}
