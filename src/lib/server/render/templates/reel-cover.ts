/**
 * reel-cover — Reel Cover
 * Vertical 9:16 (1080×1920). Bold text overlay on photo/gradient.
 * Hook viewers in the first frame. Used for Instagram Reels + TikTok.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, fontStack, logoBlock } from "./types"

export function buildHtml(d: TemplateData): string {
  const hStack       = fontStack(d.fontHeading)
  const bStack       = fontStack(d.fontBody)
  const pad          = Math.round(d.width * 0.07)
  const hookFontPx   = fs(d.width, d.headline.length > 40 ? 0.085 : 0.105)
  const subtextFontPx = fs(d.width, 0.042)
  const ctaFontPx    = fs(d.width, 0.038)
  const nameFontPx   = fs(d.width, 0.030)
  const logoSize     = Math.round(d.width * 0.06)

  // Background: use uploaded media or fall back to brand gradient
  const bgStyle = d.mediaUrl
    ? `background-image: url("${esc(d.mediaUrl)}"); background-size: cover; background-position: center;`
    : `background: linear-gradient(160deg, ${d.primaryColor} 0%, ${d.secondaryColor} 100%);`

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
    /* Dark vignette overlay — makes text readable over any photo */
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.35) 0%,
        rgba(0,0,0,0.1) 30%,
        rgba(0,0,0,0.15) 55%,
        rgba(0,0,0,0.75) 100%
      );
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${Math.round(d.width * 0.05)}px ${pad}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
      color: rgba(255,255,255,0.9); text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
    /* Push content to bottom — typical reel text placement */
    .spacer { flex: 1; }
    .body {
      padding: 0 ${pad}px ${Math.round(d.height * 0.05)}px;
      display: flex; flex-direction: column;
      position: relative; z-index: 1;
    }
    .hook-label {
      font-family: ${bStack}; font-size: ${fs(d.width, 0.028)}px;
      color: ${d.primaryColor}; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; margin-bottom: ${Math.round(d.height * 0.015)}px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }
    .headline {
      font-family: ${hStack}; font-weight: 900; font-size: ${hookFontPx}px;
      color: #ffffff; line-height: 1.05; letter-spacing: -0.025em;
      word-break: break-word;
      text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.018)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: rgba(255,255,255,0.82); line-height: 1.45;
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .cta {
      margin-top: ${Math.round(d.height * 0.025)}px;
      display: inline-flex; align-items: center; gap: 8px;
      padding: ${Math.round(d.height * 0.012)}px ${Math.round(d.width * 0.055)}px;
      background: ${d.primaryColor}; color: #fff;
      border-radius: 9999px;
      font-family: ${hStack}; font-weight: 700; font-size: ${ctaFontPx}px;
      align-self: flex-start;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
    }
    /* Bottom brand strip */
    .bottom-bar {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 4px; background: ${d.primaryColor};
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
      <span class="hook-label">Watch this →</span>
      <p class="headline">${esc(truncate(d.headline, 100))}</p>
      ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 140))}</p>` : ""}
      ${d.cta ? `<span class="cta">${esc(d.cta)}</span>` : ""}
    </div>
    <div class="bottom-bar"></div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "reel-cover",
  name:        "Reel Cover",
  description: "Vertical 9:16 bold text over image/gradient. Hook viewers in the first frame.",
  type:        "reel_cover",
  platforms:   ["instagram", "tiktok"],
  buildHtml,
}
