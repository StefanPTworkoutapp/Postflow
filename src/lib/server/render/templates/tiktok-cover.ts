/**
 * tiktok-cover — TikTok Photo Cover
 * Vertical 9:16 (1080×1920). For TikTok's photo-mode / single-image posts —
 * NOT a video reel. Distinct from reel-cover.ts, which covers the first
 * frame of an actual video reel (dark vignette over footage, "watch this"
 * hook label). This template is a from-scratch graphic: bold brand-colour
 * gradient background, a huge hook headline centered in the upper third,
 * and a chevron cue nudging the viewer to keep scrolling/swiping.
 *
 * Layout:
 *   • Brand + logo — top, small and quiet
 *   • Hook headline — huge, centered in the upper third
 *   • Kicker pill — small label above the headline
 *   • Decorative dot grid — bottom corner, brand-colour accent
 *   • Chevron cue — bottom center, "keep scrolling" affordance
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, fontStack, logoBlock, styleInterp } from "./types"

export function buildHtml(d: TemplateData): string {
  const style  = d.templateStyle ?? 50
  const hStack = fontStack(d.fontHeading)
  const bStack = fontStack(d.fontBody)
  const pad    = Math.round(d.width * 0.09)

  const headlineWeight = style < 50 ? 800 : 900
  const headlineLS     = `${styleInterp(style, -0.01, -0.03).toFixed(3)}em`

  const headlineFontPx = fs(d.width, d.headline.length > 50 ? 0.088 : 0.11)
  const kickerFontPx   = fs(d.width, 0.032)
  const nameFontPx     = fs(d.width, 0.032)
  const logoSize       = Math.round(d.width * 0.065)
  const dotSize        = Math.round(d.width * 0.018)

  // Bold brand-colour gradient — this is a native graphic, not a photo card
  const bgGradient = `linear-gradient(165deg, ${d.primaryColor} 0%, ${d.secondaryColor} 55%, ${d.accentColor} 100%)`

  // 3x3 decorative dot grid, bottom-right corner
  const dots = `<span class="dot"></span>`.repeat(9)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
    .card {
      width: ${d.width}px; height: ${d.height}px;
      background: ${bgGradient};
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    /* Soft radial glow behind the hook for depth */
    .glow {
      position: absolute;
      width: ${Math.round(d.width * 1.5)}px; height: ${Math.round(d.width * 1.5)}px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, transparent 65%);
      top: ${Math.round(d.height * -0.12)}px; left: 50%; transform: translateX(-50%);
      pointer-events: none;
    }
    .header {
      display: flex; align-items: center; gap: 10px;
      padding: ${Math.round(d.height * 0.045)}px ${pad}px 0;
      position: relative; z-index: 1;
    }
    .brand {
      font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
      color: rgba(255,255,255,0.85); letter-spacing: -0.01em;
      text-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
    /* Content sits in the upper third, per TikTok photo-mode reading pattern */
    .body {
      padding: ${Math.round(d.height * 0.06)}px ${pad}px 0;
      position: relative; z-index: 1;
    }
    .kicker {
      display: inline-block;
      padding: ${Math.round(d.height * 0.01)}px ${Math.round(d.width * 0.04)}px;
      background: rgba(255,255,255,0.18);
      border-radius: 9999px;
      font-family: ${bStack}; font-weight: 700; font-size: ${kickerFontPx}px;
      color: #ffffff; letter-spacing: 0.06em; text-transform: uppercase;
      margin-bottom: ${Math.round(d.height * 0.028)}px;
    }
    .headline {
      font-family: ${hStack}; font-weight: ${headlineWeight}; font-size: ${headlineFontPx}px;
      color: #ffffff; line-height: 1.05; letter-spacing: ${headlineLS};
      word-break: break-word;
      text-shadow: 0 3px 20px rgba(0,0,0,0.3);
    }
    .spacer { flex: 1; }
    /* Chevron cue — nudges viewer to keep scrolling */
    .chevron-stack {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      position: relative; z-index: 1;
      padding-bottom: ${Math.round(d.height * 0.06)}px;
    }
    .chevron {
      width: ${Math.round(d.width * 0.05)}px; height: ${Math.round(d.width * 0.05)}px;
      border-right: 5px solid rgba(255,255,255,0.75);
      border-bottom: 5px solid rgba(255,255,255,0.75);
      transform: rotate(45deg);
    }
    .chevron.dim { border-color: rgba(255,255,255,0.35); }
    /* Decorative dot grid, bottom-right */
    .dot-grid {
      position: absolute; right: ${pad}px; bottom: ${Math.round(d.height * 0.05)}px;
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: ${Math.round(dotSize * 0.7)}px;
      z-index: 1;
    }
    .dot { width: ${dotSize}px; height: ${dotSize}px; border-radius: 50%; background: rgba(255,255,255,0.35); }
  </style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="header">
      ${logoBlock(d, logoSize)}
      <span class="brand">${esc(d.brandName)}</span>
    </div>
    <div class="body">
      <span class="kicker">${d.cta ? esc(d.cta) : "Watch"}</span>
      <p class="headline">${esc(truncate(d.headline, 90))}</p>
    </div>
    <div class="spacer"></div>
    <div class="dot-grid">${dots}</div>
    <div class="chevron-stack">
      <div class="chevron"></div>
      <div class="chevron dim"></div>
    </div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "tiktok-cover",
  name:        "TikTok — Photo Cover",
  description: "Vertical brand-colour gradient cover for TikTok photo-mode posts. Huge hook headline + scroll-cue chevron. Not for video reels — see Reel Cover.",
  type:        "single_image",
  platforms:   ["tiktok"],
  buildHtml,
}
