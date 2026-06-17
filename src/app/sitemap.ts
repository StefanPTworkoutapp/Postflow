import type { MetadataRoute } from "next"

const BASE = "https://postflowsocials.app"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:              `${BASE}/join`,
      lastModified:     new Date(),
      changeFrequency:  "monthly",
      priority:         1.0,
    },
    {
      url:              `${BASE}/contact`,
      lastModified:     new Date(),
      changeFrequency:  "yearly",
      priority:         0.6,
    },
    {
      url:              `${BASE}/privacy`,
      lastModified:     new Date(),
      changeFrequency:  "yearly",
      priority:         0.2,
    },
    {
      url:              `${BASE}/terms`,
      lastModified:     new Date(),
      changeFrequency:  "yearly",
      priority:         0.2,
    },
  ]
}
