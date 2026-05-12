/**
 * MusicPicker — displays 3 music track options with 10s preview clips.
 *
 * Tracks are returned from POST /api/clip-forge/create (selectMusicTracks).
 * The user picks one; the selected full_url is passed to /api/clip-forge/[id]/render.
 *
 * Audio:
 * - Only one track plays at a time
 * - Plays from preview_url (10s clip)
 * - Shows progress bar while playing
 * - Stops when another track is selected for preview
 *
 * The "No music" option is always available as a final choice.
 */

"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Music, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MusicTrack } from "@/lib/server/music/music-selector"

interface MusicPickerProps {
  tracks:   MusicTrack[]
  value:    string | null   // selected full_url (or null = no music)
  onChange: (fullUrl: string | null) => void
  className?: string
}

const ENERGY_LABELS: Record<string, string> = {
  low:         "Calm",
  medium:      "Steady",
  medium_high: "Energetic",
  high:        "High Energy",
}

const BPM_COLOR = (bpm: number) =>
  bpm < 90  ? "text-blue-500"   :
  bpm < 120 ? "text-emerald-500" :
  bpm < 135 ? "text-amber-500"  : "text-rose-500"

export function MusicPicker({ tracks, value, onChange, className }: MusicPickerProps) {
  const [playingId, setPlayingId]     = useState<string | null>(null)
  const [progress,  setProgress]      = useState<Record<string, number>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef   = useRef<number | null>(null)

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPlayingId(null)
  }, [])

  const playTrack = useCallback((track: MusicTrack) => {
    if (playingId === track.id) {
      stopAudio()
      return
    }

    stopAudio()

    const audio = new Audio(track.preview_url)
    audioRef.current = audio

    audio.addEventListener("ended", () => {
      setPlayingId(null)
      setProgress(p => ({ ...p, [track.id]: 0 }))
    })

    const updateProgress = () => {
      if (!audio.duration) return
      setProgress(p => ({
        ...p,
        [track.id]: (audio.currentTime / audio.duration) * 100,
      }))
      if (!audio.paused && !audio.ended) {
        rafRef.current = requestAnimationFrame(updateProgress)
      }
    }

    audio.play().then(() => {
      setPlayingId(track.id)
      rafRef.current = requestAnimationFrame(updateProgress)
    }).catch(err => {
      console.warn("[MusicPicker] audio play failed:", err)
    })
  }, [playingId, stopAudio])

  // Clean up on unmount
  useEffect(() => () => stopAudio(), [stopAudio])

  return (
    <div className={cn("space-y-3", className)}>
      {/* Track options */}
      {tracks.map(track => {
        const selected  = value === track.full_url
        const isPlaying = playingId === track.id
        const pct       = progress[track.id] ?? 0

        return (
          <div
            key={track.id}
            role="button"
            tabIndex={0}
            onClick={() => onChange(track.full_url)}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && onChange(track.full_url)}
            className={cn(
              "relative flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all outline-none",
              "hover:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-400",
              selected
                ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                : "border-border bg-card",
            )}
          >
            {/* Play/pause button */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); playTrack(track) }}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                isPlaying
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
              )}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium truncate", selected && "text-indigo-700 dark:text-indigo-300")}>
                  {track.title}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ENERGY_LABELS[track.energy] ?? track.energy}
                </span>
              </div>

              {/* Genres + BPM */}
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Music className="h-3 w-3 shrink-0" />
                <span className="truncate">{track.genres.join(", ")}</span>
                <span className="shrink-0">·</span>
                <Volume2 className="h-3 w-3 shrink-0" />
                <span className={cn("shrink-0 font-medium", BPM_COLOR(track.bpm))}>
                  {track.bpm} BPM
                </span>
              </div>

              {/* Progress bar (shows during playback) */}
              <div className={cn(
                "mt-2 h-0.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden transition-opacity",
                isPlaying ? "opacity-100" : "opacity-0",
              )}>
                <div
                  className="h-full bg-indigo-500 transition-none"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Selected ring indicator */}
            {selected && (
              <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
            )}
          </div>
        )
      })}

      {/* No music option */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onChange(null)}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && onChange(null)}
        className={cn(
          "flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all outline-none",
          "hover:border-zinc-400/60 focus-visible:ring-2 focus-visible:ring-zinc-400",
          value === null
            ? "border-zinc-500 bg-zinc-50 dark:bg-zinc-900"
            : "border-border bg-card",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Music className="h-4 w-4 text-zinc-400" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">No music</span>
        {value === null && (
          <div className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-500" />
        )}
      </div>
    </div>
  )
}
