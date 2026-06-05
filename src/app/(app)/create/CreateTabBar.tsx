"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "video",     label: "Video"          },
  { value: "stories",   label: "Stories & Reels" },
  { value: "templates", label: "Templates"       },
] as const

type Tab = (typeof TABS)[number]["value"]

export function CreateTabBar({ activeTab }: { activeTab: Tab }) {
  const router   = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex items-end gap-1 border-b">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => router.push(`${pathname}?tab=${tab.value}`)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              isActive
                ? "text-foreground border-b-2 border-[var(--pf-teal)] -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
