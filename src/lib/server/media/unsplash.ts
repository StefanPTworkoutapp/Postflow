/**
 * Unsplash stock image search
 *
 * Wraps the Unsplash API /search/photos endpoint.
 * Attribution is required by the Unsplash API Terms of Service:
 *   - Author name + link must be shown alongside any displayed image
 *   - The download_location endpoint must be pinged when a photo is selected
 *     (triggers the "download" event required by Unsplash TOS)
 *
 * Required env var: UNSPLASH_ACCESS_KEY
 */

const UNSPLASH_API = "https://api.unsplash.com"

export interface UnsplashPhoto {
  id:                string
  url:               string      // full-size download URL (raw)
  thumb:             string      // small preview (thumb)
  regular:           string      // regular quality for display
  download_location: string      // must be hit when user selects/downloads
  alt_description:   string | null
  author: {
    name:     string
    username: string
    link:     string             // author profile link
  }
}

export interface UnsplashSearchResult {
  photos: UnsplashPhoto[]
  total: number
}

/**
 * Search Unsplash for photos matching the given query.
 *
 * @param query       — search term (e.g. "fitness gym", "healthy food")
 * @param orientation — optional layout hint: "landscape" | "portrait" | "squarish"
 * @param perPage     — number of results (default 9, max 30)
 * @param page        — pagination (default 1)
 */
export async function searchPhotos(
  query:       string,
  orientation?: "landscape" | "portrait" | "squarish",
  perPage      = 9,
  page         = 1,
): Promise<UnsplashSearchResult> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) throw new Error("UNSPLASH_ACCESS_KEY not configured")

  const url = new URL(`${UNSPLASH_API}/search/photos`)
  url.searchParams.set("query",    query)
  url.searchParams.set("per_page", String(perPage))
  url.searchParams.set("page",     String(page))
  if (orientation) url.searchParams.set("orientation", orientation)

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization":    `Client-ID ${accessKey}`,
      "Accept-Version":   "v1",
    },
    // Cache search results for 5 minutes — same query + orientation produces
    // the same results within that window, avoiding redundant API calls
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Unsplash API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as {
    total: number
    results: Array<{
      id:                string
      alt_description:   string | null
      urls: {
        raw:     string
        regular: string
        thumb:   string
      }
      links: {
        download_location: string
      }
      user: {
        name:     string
        username: string
        links: {
          html: string
        }
      }
    }>
  }

  return {
    total:  data.total,
    photos: data.results.map(r => ({
      id:                r.id,
      url:               r.urls.raw,
      regular:           r.urls.regular,
      thumb:             r.urls.thumb,
      download_location: r.links.download_location,
      alt_description:   r.alt_description,
      author: {
        name:     r.user.name,
        username: r.user.username,
        link:     r.user.links.html,
      },
    })),
  }
}

/**
 * Trigger the Unsplash "download" event for a selected photo.
 * REQUIRED by Unsplash API Terms of Service when a user downloads/uses a photo.
 */
export async function triggerUnsplashDownload(downloadLocation: string): Promise<void> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return // silently skip if not configured

  try {
    await fetch(downloadLocation, {
      headers: {
        "Authorization":  `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    })
  } catch {
    // Non-fatal — best effort
  }
}
