/**
 * photo-overlay — Photo with Text Overlay
 * Full-bleed background photo, dark gradient overlay, brand + caption text on top.
 * This is the core Instagram photo post format — clean, professional, ready to post.
 *
 * Layout (portrait 1080×1350):
 *   • Brand name + logo — top left
 *   • Photo fills entire card
 *   • Gradient: top fade (dark) + bottom fade (darker) — keeps text readable
 *   • Hook headline — bottom left, large bold white
 *   • Subtext — below headline, smaller
 *   • Brand accent bar — very bottom edge
 *
 * Falls back to brand gradient if no mediaUrl is provided.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, fontStack, logoBlock } from "./types"

export function buildHtml(d: TemplateData): string {
  const hStack        = fontStack(d.fontHeading)
  const bStack        = fontStack(d.fontBody)
  const pad           = Math.round(d.width * 0.072)
  const headlineFontPx = fs(d.width, d.headline.length > 60 ? 0.072 : 0.088)
  const subtextFontPx  = fs(d.width, 0.038)
  const nameFontPx    = fs(d.width, 0.030)
  const tagFontPx     = fs(d.width, 0.026)
  const ctaFontPx     = fs(d.width, 0.034)
  const logoSize      = Math.round(d.width * 0.06)
  const accentBarPx   = Math.round(d.height * 0.008)

  // Full-bleed photo or brand gradient fallback
  const bgStyle = d.mediaUrl
    ? `background-image: url("${esc(d.mediaUrl)}"); background-size: cover; background-position: center;`
    : `background: linear-gradient(155deg, ${d.primaryColor} 0%, ${d.secondaryColor ?? "#0f172a"} 100%);`

  const hashLine = (d.hashtags ?? []).slice(0, 6).map(h => `#${esc(h)}`).join(" ")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }

    .card {
      width: ${d.width}px; height: ${d.height}px;
      ${bgStyle}
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }

    /* Top-to-bottom gradient overlay — darkens top + bottom so text pops */
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.52) 0%,
        rgba(0,0,0,0.04) 30%,
        rgba(0,0,0,0.04) 50%,
        rgba(0,0,0,0.62) 75%,
        rgba(0,0,0,0.82) 100%
      );
    }

    /* Header row */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${Math.round(d.width * 0.048)}px ${pad}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .brand {
      font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
      color: rgba(255,255,255,0.92);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
      letter-spacing: -0.01em;
    }

    /* Push body to bottom */
    .spacer { flex: 1; }

    /* Bottom content */
    .body {
      padding: 0 ${pad}px ${Math.round(d.height * 0.022)}px;
      display: flex; flex-direction: column;
      position: relative; z-index: 1;
    }
    .accent-pill {
      width: ${Math.round(d.width * 0.07)}px; height: 4px;
      background: ${d.primaryColor}; border-radius: 2px;
      margin-bottom: ${Math.round(d.height * 0.018)}px;
    }
    .headline {
      font-family: ${hStack}; font-weight: 800; font-size: ${headlineFontPx}px;
      color: #ffffff; line-height: 1.1; letter-spacing: -0.025em;
      word-break: break-word;
      text-shadow: 0 2px 16px rgba(0,0,0,0.55);
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.018)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: rgba(255,255,255,0.80); line-height: 1.5; font-weight: 400;
      text-shadow: 0 1px 8px rgba(0,0,0,0.45);
    }
    .cta {
      margin-top: ${Math.round(d.height * 0.025)}px;
      display: inline-block;
      padding: ${Math.round(d.height * 0.012)}px ${Math.round(d.width * 0.044)}px;
      background: ${d.primaryColor}; color: #fff;
      border-radius: 9999px;
      font-family: ${hStack}; font-weight: 700; font-size: ${ctaFontPx}px;
      align-self: flex-start; letter-spacing: 0.01em;
      box-shadow: 0 3px 14px rgba(0,0,0,0.4);
    }

    /* Hashtags row */
    .footer {
      padding: ${Math.round(d.height * 0.016)}px ${pad}px;
      display: flex; align-items: center;
      flex-shrink: 0; position: relative; z-index: 1;
      border-top: 1px solid rgba(255,255,255,0.12);
    }
    .hashtags {
      font-size: ${tagFontPx}px; color: rgba(255,255,255,0.6);
      font-weight: 500; word-break: break-all;
    }

    /* Brand colour accent bar at very bottom */
    .accent-bar {
      height: ${accentBarPx}px; background: ${d.primaryColor};
      flex-shrink: 0; position: relative; z-index: 1;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="overlay"></div>

    <div class="header">
      <span class="brand">${esc(d.brandName)}</span>
      ${logoBlock(d, logoSize)}
    </div>

    <div class="spacer"></div>

    <div class="body">
      <div class="accent-pill"></div>
      <p class="headline">${esc(truncate(d.headline, 100))}</p>
      ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 120))}</p>` : ""}
      ${d.cta ? `<span class="cta">${esc(d.cta)}</span>` : ""}
    </div>

    ${hashLine ? `
    <div class="footer">
      <span class="hashtags">${hashLine}</span>
    </div>` : ""}

    <div class="accent-bar"></div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "photo-overlay",
  name:        "Photo with Caption",
  description: "Full-bleed photo with gradient overlay and bold caption text. The go-to Instagram format for photo posts.",
  type:        "single_image",
  platforms:   null,
  buildHtml,
}
