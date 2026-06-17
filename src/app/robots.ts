import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     ["/", "/join", "/contact", "/privacy", "/terms"],
        disallow:  ["/dashboard", "/posts", "/calendar", "/analytics", "/settings", "/api/", "/onboarding", "/portal"],
      },
    ],
    sitemap: "https://postflowsocials.app/sitemap.xml",
  }
}
