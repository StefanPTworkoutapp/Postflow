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
  ShieldCheck,
  Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { label: "Dashboard",      href: "/dashboard",            icon: LayoutDashboard },
  { label: "Calendar",       href: "/calendar",             icon: CalendarDays    },
  { label: "Upload",         href: "/upload",               icon: Upload          },
  { label: "Posts",          href: "/posts",                icon: FileText        },
  { label: "Stories & Reels",href: "/stories",              icon: Clapperboard   },
  { label: "Create Video",   href: "/create",               icon: Wand2           },
  { label: "Trend Builder",  href: "/trend",                icon: TrendingUp      },
  { label: "Analytics",      href: "/analytics",            icon: BarChart2       },
  { label: "Brand Intel",    href: "/brand-intelligence",   icon: Brain           },
  { label: "Brand",          href: "/brand",                icon: Palette         },
  { label: "Templates",      href: "/templates",            icon: LayoutTemplate  },
  { label: "Inspiration",    href: "/inspiration",          icon: Sparkles        },
  { label: "Connections",    href: "/settings/connections", icon: Link2           },
  { label: "Settings",       href: "/settings",             icon: Settings        },
]

/** Only visible for the admin account */
const ADMIN_EMAIL = "info@mindyourbodypt.nl"

interface SidebarProps {
  userEmail?: string
}

function NavLink({ label, href, icon: Icon }: { label: string; href: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== "/settings" && pathname.startsWith(href + "/"))
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

export function Sidebar({ userEmail }: SidebarProps) {
  const isAdmin = userEmail === ADMIN_EMAIL

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shrink-0">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-[hsl(var(--sidebar-border))]">
        <Zap className="h-5 w-5 text-[var(--pf-teal)] shrink-0" />
        <span className="font-semibold text-sm tracking-tight">PostFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => <NavLink key={item.href} {...item} />)}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]/30">
                Admin
              </p>
            </div>
            <NavLink label="System Health" href="/admin" icon={ShieldCheck} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] px-3 py-3">
        <p className="text-xs text-[hsl(var(--sidebar-foreground))]/30 truncate">PostFlow v1</p>
      </div>
    </aside>
  )
}
