/**
 * tip-numbered — Numbered Tip
 * Giant number in brand colour as background element.
 * Perfect for "Top X tips" and step-by-step numbered content.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, tint, fontStack, logoBlock } from "./types"

export function buildHtml(d: TemplateData): string {
  const hStack        = fontStack(d.fontHeading)
  const bStack        = fontStack(d.fontBody)
  const pad           = Math.round(d.width * 0.075)
  const headlineFontPx = fs(d.width, d.headline.length > 80 ? 0.056 : 0.068)
  const subtextFontPx  = fs(d.width, 0.036)
  const numberFontPx  = fs(d.width, 0.52)   // huge background number
  const nameFontPx    = fs(d.width, 0.031)
  const tagFontPx     = fs(d.width, 0.026)
  const ctaFontPx     = fs(d.width, 0.033)
  const logoSize      = Math.round(d.width * 0.065)
  const accentBg      = tint(d.primaryColor, "08")
  const barPx         = Math.round(d.height * 0.01)

  // Extract leading number from headline if present (e.g. "5 tips to…" → "5")
  const numberMatch = d.headline.match(/^(\d+)/)
  const displayNumber = numberMatch?.[1] ?? (d.slideIndex !== undefined ? String(d.slideIndex + 1) : "1")

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
      background: #ffffff;
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    /* Giant background number */
    .bg-number {
      position: absolute;
      font-family: ${hStack}; font-weight: 900; font-size: ${numberFontPx}px;
      color: ${d.primaryColor}; opacity: 0.07;
      line-height: 1; user-select: none;
      right: ${Math.round(d.width * -0.04)}px;
      bottom: ${Math.round(d.height * 0.08)}px;
      z-index: 0;
    }
    .accent-bar { width: 100%; height: ${barPx}px; background: ${d.primaryColor}; flex-shrink: 0; }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${Math.round(d.width * 0.04)}px ${pad}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px; color: ${d.primaryColor}; letter-spacing: -0.01em; }
    .body {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 0 ${pad}px; position: relative; z-index: 1;
    }
    /* Small number badge */
    .number-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: ${fs(d.width, 0.115)}px; height: ${fs(d.width, 0.115)}px;
      background: ${d.primaryColor}; border-radius: 16px;
      font-family: ${hStack}; font-weight: 900; font-size: ${fs(d.width, 0.062)}px;
      color: #fff; margin-bottom: ${Math.round(d.height * 0.028)}px;
      flex-shrink: 0;
    }
    .headline {
      font-family: ${hStack}; font-weight: 800; font-size: ${headlineFontPx}px;
      color: #0f172a; line-height: 1.15; letter-spacing: -0.025em;
      word-break: break-word;
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.025)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: #475569; line-height: 1.55; font-weight: 400;
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
      padding: ${Math.round(d.height * 0.02)}px ${pad}px;
      display: flex; align-items: center;
      flex-shrink: 0; position: relative; z-index: 1;
      background: ${accentBg};
      border-top: 2px solid ${d.primaryColor}20;
    }
    .hashtags { font-size: ${tagFontPx}px; color: ${d.primaryColor}; font-weight: 500; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <span class="bg-number">${esc(displayNumber)}</span>
    <div class="accent-bar"></div>
    <div class="header">
      <span class="brand">${esc(d.brandName)}</span>
      ${logoBlock(d, logoSize)}
    </div>
    <div class="body">
      <div class="number-badge">${esc(displayNumber)}</div>
      <p class="headline">${esc(truncate(d.headline, 160))}</p>
      ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 220))}</p>` : ""}
      ${d.cta ? `<span class="cta">${esc(d.cta)}</span>` : ""}
    </div>
    <div class="footer">
      ${hashLine ? `<span class="hashtags">${hashLine}</span>` : ""}
    </div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "tip-numbered",
  name:        "Numbered Tip",
  description: "Large number in brand colour with tip text. Great for \"Top X\" and step-by-step content.",
  type:        "single_image",
  platforms:   null,
  buildHtml,
}
