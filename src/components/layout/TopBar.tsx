"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Plus, Layers, HardDrive, AlertTriangle, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { RenderQueueDrawer } from "@/components/shared/RenderQueueDrawer"

// localStorage key — stores ISO timestamp of last dismiss
const DISMISS_KEY_70  = "pf_storage_warn_dismissed_70"
const DISMISS_KEY_90  = "pf_storage_warn_dismissed_90"
const DISMISS_TTL_70  = 7 * 24 * 60 * 60 * 1000   // 7 days
const DISMISS_TTL_90  = 24 * 60 * 60 * 1000        // 24 h (re-warn sooner at critical)

interface TopBarProps {
  userEmail?:        string
  userName?:         string
  storagePercent?:   number   // 0–100
  storageLimitGb?:   number
  tier?:             string
  activeBrandName?:  string
  activeBrandColor?: string
}

export function TopBar({ userEmail, userName, storagePercent = 0, storageLimitGb = 1, tier = "free", activeBrandName, activeBrandColor }: TopBarProps) {
  const router   = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [bellOpen, setBellOpen]       = useState(false)
  const [dismissed70, setDismissed70] = useState(true)   // start hidden; resolved in effect
  const [dismissed90, setDismissed90] = useState(true)
  const [mounted, setMounted]         = useState(false)

  // Resolve dismiss state after mount (localStorage is SSR-safe this way)
  useEffect(() => {
    setMounted(true)
    const d70 = localStorage.getItem(DISMISS_KEY_70)
    const d90 = localStorage.getItem(DISMISS_KEY_90)
    setDismissed70(d70 ? Date.now() - Number(d70) < DISMISS_TTL_70 : false)
    setDismissed90(d90 ? Date.now() - Number(d90) < DISMISS_TTL_90 : false)
  }, [])

  const isCritical = storagePercent >= 90
  const isWarning  = storagePercent >= 70

  // Whether to show the dot + popover content
  const showAlert  = mounted && isWarning && (isCritical ? !dismissed90 : !dismissed70)

  function dismiss() {
    if (isCritical) {
      localStorage.setItem(DISMISS_KEY_90, String(Date.now()))
      setDismissed90(true)
    } else {
      localStorage.setItem(DISMISS_KEY_70, String(Date.now()))
      setDismissed70(true)
    }
    setBellOpen(false)
  }

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "?"

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b bg-[hsl(var(--background))] px-4 shrink-0">
        {/* Left: active brand slot */}
        <div>
          {activeBrandName && (
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeBrandColor ?? "#6366f1" }}
              />
              <span className="text-sm font-medium truncate max-w-[180px]">{activeBrandName}</span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => router.push("/posts/new")}>
            <Plus className="h-4 w-4" />
            New Post
          </Button>

          {/* Render queue trigger */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Render queue"
            onClick={() => setDrawerOpen(true)}
          >
            <Layers className="h-4 w-4" />
          </Button>

          {/* Bell — shows storage warning dot + popover when ≥70% full */}
          <Popover open={bellOpen} onOpenChange={setBellOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative"
              >
                <Bell className="h-4 w-4" />
                {showAlert && (
                  <span
                    className={cn(
                      "absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-background",
                      isCritical ? "bg-red-500" : "bg-amber-500"
                    )}
                  />
                )}
              </Button>
            </PopoverTrigger>

            {showAlert && (
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn("h-4 w-4 shrink-0", isCritical ? "text-red-500" : "text-amber-500")} />
                      <p className="text-sm font-semibold">
                        {isCritical ? "Storage almost full" : "Storage at 70%"}
                      </p>
                    </div>
                    <button
                      onClick={dismiss}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Message */}
                  <p className="text-xs text-muted-foreground">
                    {isCritical
                      ? `You've used ${storagePercent}% of your ${storageLimitGb} GB storage on the ${tier} plan. Uploads will be blocked when full.`
                      : `You've used ${storagePercent}% of your ${storageLimitGb} GB storage on the ${tier} plan. Consider upgrading before you run out.`}
                  </p>

                  {/* Mini progress bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn("h-1.5 rounded-full", isCritical ? "bg-red-500" : "bg-amber-500")}
                      style={{ width: `${storagePercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">{storagePercent}% of {storageLimitGb} GB</p>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {isCritical ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => { router.push("/settings/billing#storage-addon"); setBellOpen(false) }}
                        >
                          Add +50 GB — €5
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => { router.push("/settings/billing"); setBellOpen(false) }}
                        >
                          Upgrade plan
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => { router.push("/settings/billing"); setBellOpen(false) }}
                        >
                          Upgrade plan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={dismiss}
                        >
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                  {isCritical && (
                    <button
                      onClick={dismiss}
                      className="text-xs text-muted-foreground hover:text-foreground text-right w-full"
                    >
                      Dismiss for 24h
                    </button>
                  )}

                  {/* Storage icon footer */}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t">
                    <HardDrive className="h-3 w-3" />
                    <span>Manage storage in <a href="/settings/billing" className="underline hover:text-foreground">Settings → Billing</a></span>
                  </div>
                </div>
              </PopoverContent>
            )}
          </Popover>

          {/* Trial badge */}
          {tier === "free" && (
            <span className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Trial
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Profile menu">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{userName ?? "My Account"}</p>
                {userEmail && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{userEmail}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/settings">Settings</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-[hsl(var(--destructive))]">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Render queue drawer */}
      <RenderQueueDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
