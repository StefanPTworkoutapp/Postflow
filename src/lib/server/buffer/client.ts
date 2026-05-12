/**
 * Buffer Public API client (GraphQL)
 * Docs: https://developers.buffer.com
 * Auth: Bearer token (personal access token from Buffer Settings → API)
 */

const BUFFER_API = "https://api.buffer.com"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BufferChannel {
  id:      string
  name:    string
  service: string   // "instagram" | "linkedin" | "facebook" | "twitter" | "tiktok" | "threads"
  avatar?: string
}

export interface BufferPost {
  id:     string
  text:   string
  dueAt:  string | null
  status: string
}

// ─── GraphQL helper ───────────────────────────────────────────────────────────

async function gql<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {},
  accessToken: string,
): Promise<T> {
  const res = await fetch(BUFFER_API, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  const json = await res.json() as { data?: T; errors?: { message: string }[] }

  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `Buffer API error ${res.status}`)
  }

  return json.data as T
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Fetch the first organization ID for the token owner */
async function getOrganizationId(accessToken: string): Promise<string> {
  const data = await gql<{ account: { organizations: { id: string }[] } }>(
    `query GetOrganizations {
       account {
         organizations {
           id
         }
       }
     }`,
    {},
    accessToken,
  )
  const orgId = data.account?.organizations?.[0]?.id
  if (!orgId) throw new Error("No Buffer organization found for this token.")
  return orgId
}

/** Fetch all connected channels for the token owner */
export async function getBufferChannels(accessToken: string): Promise<BufferChannel[]> {
  const organizationId = await getOrganizationId(accessToken)

  const data = await gql<{ channels: BufferChannel[] }>(
    `query GetChannels($input: ChannelsInput!) {
       channels(input: $input) {
         id
         name
         service
       }
     }`,
    { input: { organizationId } },
    accessToken,
  )
  return data.channels ?? []
}

/** Map Buffer service name to PostFlow platform key */
export function bufferServiceToPlatform(service: string): string {
  const map: Record<string, string> = {
    instagram: "instagram",
    linkedin:  "linkedin",
    facebook:  "facebook",
    twitter:   "x",
    tiktok:    "tiktok",
    threads:   "threads",
    pinterest: "pinterest",
  }
  return map[service.toLowerCase()] ?? service.toLowerCase()
}

/** Schedule a post via the Buffer GraphQL API */
export async function scheduleBufferPost(opts: {
  accessToken:   string
  channelId:     string
  text:          string
  scheduledAt?:  Date          // if omitted → adds to queue
  mediaUrls?:    string[]
}): Promise<BufferPost> {
  const mode  = opts.scheduledAt ? "customScheduled" : "addToQueue"
  const dueAt = opts.scheduledAt ? opts.scheduledAt.toISOString() : null

  // Buffer API v2 assets shape: ordered array of { image: { url } }
  // (changed from { images: [{ url }] } — deadline May 25 2026)
  const assets = (opts.mediaUrls ?? []).map(url => ({ image: { url } }))

  // Fetch org ID (needed by createPost)
  const organizationId = await getOrganizationId(opts.accessToken)

  const mutation = `
    mutation CreatePost($input: PostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
            status
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `

  const input: Record<string, unknown> = {
    text:           opts.text,
    channelId:      opts.channelId,
    organizationId,
    schedulingType: "automatic",
    mode,
    ...(dueAt         ? { dueAt }   : {}),
    ...(assets.length ? { assets }  : {}),
  }

  const data = await gql<{
    createPost: { post?: BufferPost; message?: string }
  }>(mutation, { input }, opts.accessToken)

  const result = data.createPost
  if (!result.post) {
    throw new Error(result.message ?? "Buffer createPost returned no post")
  }
  return result.post
}
