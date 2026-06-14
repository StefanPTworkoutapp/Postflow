/**
 * Shared types for the direct-publish pipeline.
 *
 * PublishInput is the normalised payload every publisher receives.
 * PublishResult is the normalised response every publisher returns.
 *
 * All platform-specific publishers (LinkedIn, Facebook, Instagram, TikTok)
 * consume PublishInput and return PublishResult so the dispatcher can treat
 * them uniformly.
 */

export interface PublishResult {
  /** The platform's own identifier for the post / media object just created. */
  publishedId: string
  /** Direct URL to the published post, if the platform returns one. */
  postedUrl?: string
}

export type PostType = "single_image" | "carousel" | "reel" | "story" | "text_only" | "video"

export interface PublishInput {
  /** PostFlow internal post ID (UUID). */
  postId: string
  /** PostFlow internal brand ID (UUID). Used to look up the social account. */
  brandId: string
  /** Platform slug: "linkedin" | "facebook" | "instagram" | "tiktok" */
  platform: string
  /**
   * Content type — tells the publisher which API path to use.
   * - single_image: regular feed photo post
   * - carousel:     multi-image carousel (Instagram) or multi-photo (Facebook)
   * - reel:         short-form video published as a Reel (Instagram) or video post
   * - story:        24-hour ephemeral Story (Instagram)
   * - video:        longer-form video post (LinkedIn, Facebook, TikTok)
   * - text_only:    no media attached (LinkedIn, Facebook)
   */
  postType: PostType
  /** Main post text (no hashtags). */
  caption: string
  /** Hashtag strings without the leading #. */
  hashtags: string[]
  /** Public-accessible URLs of media files to attach. Empty = text-only post. */
  mediaUrls: string[]
  /** True when mediaUrls contains multiple images and a carousel layout is desired. */
  isCarousel: boolean
}
