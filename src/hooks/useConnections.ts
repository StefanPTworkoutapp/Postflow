"use client"

/**
 * useConnections — single source of truth for platform connection state.
 *
 * Fetches social_accounts for the current brand and exposes helpers that every
 * component should use instead of querying the DB directly.
 *
 * Usage:
 *   const { connections, isConnected, getConnection, refresh, loading } = useConnections()
 *
 * Rules (from features_v6.md):
 *   - Use this hook for ALL platform state — never duplicate connection logic
 *   - Calling refresh() re-fetches from the API (e.g. after connecting a platform)
 */

import { useCallback, useEffect, useState } from "react"

export interface Connection {
  id:                  string
  platform:            string
  account_handle:      string | null
  account_url:         string | null
  buffer_profile_id:   string | null
  is_active:           boolean
  token_expires_at:    string | null
  created_at:          string
}

interface UseConnectionsResult {
  connections:   Connection[]
  loading:       boolean
  error:         string | null
  /** Returns true if the given platform has at least one active connection */
  isConnected:   (platform: string) => boolean
  /** Returns the first active connection for the given platform, or null */
  getConnection: (platform: string) => Connection | null
  /** All unique connected platform slugs */
  connectedPlatforms: string[]
  /** Whether any platform with a buffer_profile_id is connected (needed for scheduling) */
  hasBufferChannel: boolean
  /** Re-fetch from the server — call after connecting or disconnecting */
  refresh:       () => Promise<void>
}

export function useConnections(): UseConnectionsResult {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/settings/social")
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setConnections((data.connections ?? []) as Connection[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  const isConnected = useCallback(
    (platform: string) => connections.some(c => c.platform === platform && c.is_active),
    [connections]
  )

  const getConnection = useCallback(
    (platform: string) => connections.find(c => c.platform === platform && c.is_active) ?? null,
    [connections]
  )

  const connectedPlatforms = [...new Set(
    connections.filter(c => c.is_active).map(c => c.platform)
  )]

  const hasBufferChannel = connections.some(c => c.is_active && !!c.buffer_profile_id)

  return {
    connections,
    loading,
    error,
    isConnected,
    getConnection,
    connectedPlatforms,
    hasBufferChannel,
    refresh: fetch_,
  }
}
