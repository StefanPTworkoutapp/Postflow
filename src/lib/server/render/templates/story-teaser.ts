/**
 * story-teaser — Story Teaser
 * Vertical 9:16 story format (1080×1920 or 1080×1350).
 * Strong hook text at top, key content in middle, swipe-up CTA at bottom.
 * Instagram Stories only.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, fontStack, logoBlock } from "./types"

export function buildHtml(d: TemplateData): string {
  const hStack       = fontStack(d.fontHeading)
  const bStack       = fontStack(d.fontBody)
  const pad          = Math.round(d.width * 0.07)
  const hookFontPx   = fs(d.width, d.headline.length > 50 ? 0.082 : 0.1)
  const subtextFontPx = fs(d.width, 0.042)
  const ctaFontPx    = fs(d.width, 0.040)
  const nameFontPx   = fs(d.width, 0.030)
  const logoSize     = Math.round(d.width * 0.06)
  const barPx        = Math.round(d.height * 0.006)

  const bgStyle = d.mediaUrl
    ? `background-image: url("${esc(d.mediaUrl)}"); background-size: cover; background-position: center top;`
    : `background: linear-gradient(170deg, ${d.primaryColor} 0%, #0f172a 100%);`

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
    /* Gradient overlay — dark at top + bottom, lighter in middle */
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.55) 0%,
        rgba(0,0,0,0.12) 35%,
        rgba(0,0,0,0.12) 60%,
        rgba(0,0,0,0.7) 100%
      );
    }
    /* Progress bar — simulates story progress */
    .progress-bar {
      position: absolute; top: 0; left: 0; right: 0; height: ${barPx}px;
      background: rgba(255,255,255,0.25); z-index: 2; flex-shrink: 0;
    }
    .progress-fill {
      height: 100%; width: 65%; background: #ffffff; border-radius: 0 2px 2px 0;
    }
    /* Profile row */
    .header {
      display: flex; align-items: center; gap: ${Math.round(d.width * 0.03)}px;
      padding: ${Math.round(d.width * 0.05)}px ${pad}px ${Math.round(d.width * 0.03)}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
      color: #ffffff; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
    .spacer { flex: 1; }
    /* Hook text — upper section */
    .hook-section {
      padding: 0 ${pad}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .hook-label {
      display: inline-block;
      font-family: ${bStack}; font-size: ${fs(d.width, 0.026)}px;
      color: ${d.primaryColor}; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; margin-bottom: ${Math.round(d.height * 0.012)}px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .headline {
      font-family: ${hStack}; font-weight: 900; font-size: ${hookFontPx}px;
      color: #ffffff; line-height: 1.05; letter-spacing: -0.025em;
      word-break: break-word;
      text-shadow: 0 2px 12px rgba(0,0,0,0.5);
    }
    /* Middle content card */
    .middle { flex: 1; display: flex; align-items: center; padding: ${Math.round(d.height * 0.03)}px ${pad}px; position: relative; z-index: 1; }
    .content-card {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: ${Math.round(d.height * 0.025)}px ${Math.round(d.width * 0.06)}px;
      backdrop-filter: blur(4px);
      width: 100%;
    }
    .subtext {
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: rgba(255,255,255,0.9); line-height: 1.5;
    }
    /* Bottom CTA */
    .bottom {
      padding: 0 ${pad}px ${Math.round(d.height * 0.055)}px;
      display: flex; flex-direction: column; align-items: center;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .swipe-hint {
      font-family: ${bStack}; font-size: ${fs(d.width, 0.026)}px;
      color: rgba(255,255,255,0.55); letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: ${Math.round(d.height * 0.012)}px;
    }
    .cta-btn {
      width: 100%; padding: ${Math.round(d.height * 0.018)}px ${pad}px;
      background: ${d.primaryColor}; color: #fff; border-radius: 16px; text-align: center;
      font-family: ${hStack}; font-weight: 800; font-size: ${ctaFontPx}px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .cta-arrow { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="card">
    <div class="overlay"></div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="header">
      ${logoBlock(d, logoSize)}
      <span class="brand">${esc(d.brandName)}</span>
      <div class="spacer"></div>
    </div>
    <div class="hook-section">
      <span class="hook-label">Story</span>
      <p class="headline">${esc(truncate(d.headline, 90))}</p>
    </div>
    ${d.subtext ? `
    <div class="middle">
      <div class="content-card">
        <p class="subtext">${esc(truncate(d.subtext, 220))}</p>
      </div>
    </div>` : `<div class="spacer"></div>`}
    <div class="bottom">
      ${d.cta ? `
      <span class="swipe-hint">↑ Swipe up</span>
      <div class="cta-btn">${esc(d.cta)} <span class="cta-arrow">→</span></div>
      ` : ""}
    </div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "story-teaser",
  name:        "Story Teaser",
  description: "Vertical story format with strong hook text and a swipe-up style CTA.",
  type:        "story",
  platforms:   ["instagram"],
  buildHtml,
}
