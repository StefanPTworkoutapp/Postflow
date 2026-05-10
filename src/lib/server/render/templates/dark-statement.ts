/**
 * dark-statement — Dark Statement
 * Near-black background, bold white headline, brand colour accent line.
 * Strong authority feel for myth-busting, bold claims, expertise posts.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, fontStack, logoBlock } from "./types"

export function buildHtml(d: TemplateData): string {
  const hStack        = fontStack(d.fontHeading)
  const bStack        = fontStack(d.fontBody)
  const pad           = Math.round(d.width * 0.075)
  const headlineFontPx = fs(d.width, d.headline.length > 80 ? 0.058 : 0.073)
  const subtextFontPx  = fs(d.width, 0.036)
  const nameFontPx    = fs(d.width, 0.031)
  const tagFontPx     = fs(d.width, 0.026)
  const ctaFontPx     = fs(d.width, 0.033)
  const logoSize      = Math.round(d.width * 0.065)
  const barPx         = Math.round(d.height * 0.009)

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
      background: #0a0a0f;
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    /* Subtle radial glow behind headline */
    .glow {
      position: absolute;
      width: ${Math.round(d.width * 1.2)}px; height: ${Math.round(d.height * 0.7)}px;
      border-radius: 50%;
      background: radial-gradient(ellipse, ${d.primaryColor}18 0%, transparent 70%);
      top: 15%; left: 50%; transform: translateX(-50%);
      pointer-events: none;
    }
    .accent-bar { width: 100%; height: ${barPx}px; background: ${d.primaryColor}; flex-shrink: 0; }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${Math.round(d.width * 0.04)}px ${pad}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px; color: rgba(255,255,255,0.6); letter-spacing: -0.01em; }
    .body {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 0 ${pad}px; position: relative; z-index: 1;
    }
    .accent-pill {
      display: inline-block;
      width: ${fs(d.width, 0.085)}px; height: 4px;
      background: ${d.primaryColor}; border-radius: 2px;
      margin-bottom: ${Math.round(d.height * 0.028)}px;
    }
    .headline {
      font-family: ${hStack}; font-weight: 800; font-size: ${headlineFontPx}px;
      color: #ffffff; line-height: 1.12; letter-spacing: -0.025em;
      word-break: break-word;
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.025)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: rgba(255,255,255,0.55); line-height: 1.55; font-weight: 400;
    }
    .cta {
      margin-top: ${Math.round(d.height * 0.038)}px;
      display: inline-block;
      padding: ${Math.round(d.height * 0.014)}px ${Math.round(d.width * 0.048)}px;
      background: ${d.primaryColor}; color: #fff;
      border-radius: 9999px;
      font-family: ${hStack}; font-weight: 700; font-size: ${ctaFontPx}px;
      align-self: flex-start; letter-spacing: 0.01em;
    }
    .footer {
      padding: ${Math.round(d.height * 0.022)}px ${pad}px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0; position: relative; z-index: 1;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .hashtags { font-size: ${tagFontPx}px; color: ${d.primaryColor}; font-weight: 500; flex: 1; word-break: break-all; margin-right: 12px; }
    .brand-footer { font-size: ${tagFontPx}px; color: rgba(255,255,255,0.3); font-weight: 400; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="accent-bar"></div>
    <div class="header">
      <span class="brand">${esc(d.brandName)}</span>
      ${logoBlock(d, logoSize)}
    </div>
    <div class="body">
      <span class="accent-pill"></span>
      <p class="headline">${esc(truncate(d.headline, 160))}</p>
      ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 200))}</p>` : ""}
      ${d.cta ? `<span class="cta">${esc(d.cta)}</span>` : ""}
    </div>
    <div class="footer">
      ${hashLine ? `<span class="hashtags">${hashLine}</span>` : `<span></span>`}
      <span class="brand-footer">${esc(d.brandName)}</span>
    </div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "dark-statement",
  name:        "Dark Statement",
  description: "Dark background, bold white headline. Strong for myth-busting and authority posts.",
  type:        "single_image",
  platforms:   null,
  buildHtml,
}
