"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Plus, Layers } from "lucide-react"
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
import { RenderQueueDrawer } from "@/components/shared/RenderQueueDrawer"

interface TopBarProps {
  userEmail?: string
  userName?: string
}

export function TopBar({ userEmail, userName }: TopBarProps) {
  const router   = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

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
        {/* Left: page title slot */}
        <div />

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

          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>

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

      {/* Render queue drawer — triggered from the Layers icon in the top bar */}
      <RenderQueueDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
