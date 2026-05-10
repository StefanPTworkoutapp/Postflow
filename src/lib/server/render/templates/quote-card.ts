/**
 * quote-card — Quote / Motivation
 * Brand colour background, large centered quote in white.
 * Perfect for mindset, inspiration, and pull-quote posts.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, tint, fontStack, logoBlock } from "./types"

export function buildHtml(d: TemplateData): string {
  const hStack       = fontStack(d.fontHeading)
  const bStack       = fontStack(d.fontBody)
  const pad          = Math.round(d.width * 0.08)
  const quoteFontPx  = fs(d.width, d.headline.length > 100 ? 0.056 : 0.072)
  const subtextFontPx = fs(d.width, 0.034)
  const nameFontPx   = fs(d.width, 0.030)
  const tagFontPx    = fs(d.width, 0.026)
  const logoSize     = Math.round(d.width * 0.065)
  // Large decorative quotation mark
  const qMarkPx      = fs(d.width, 0.24)
  const overlayColor = tint("#000000", "22")

  const hashLine = (d.hashtags ?? []).slice(0, 5).map(h => `#${esc(h)}`).join(" ")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
    .card {
      width: ${d.width}px; height: ${d.height}px;
      background: ${d.primaryColor};
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    /* Decorative circle backdrop */
    .circle {
      position: absolute;
      width: ${Math.round(d.width * 1.1)}px; height: ${Math.round(d.width * 1.1)}px;
      border-radius: 50%;
      background: ${overlayColor};
      top: ${Math.round(d.height * -0.28)}px;
      right: ${Math.round(d.width * -0.3)}px;
      pointer-events: none;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${Math.round(d.width * 0.04)}px ${pad}px;
      flex-shrink: 0; position: relative; z-index: 1;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px; color: rgba(255,255,255,0.85); letter-spacing: -0.01em; }
    .body {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 0 ${pad}px ${Math.round(d.height * 0.02)}px;
      position: relative; z-index: 1;
    }
    .q-mark {
      font-family: ${hStack}; font-size: ${qMarkPx}px; font-weight: 900;
      color: rgba(255,255,255,0.18); line-height: 0.7;
      margin-bottom: ${Math.round(d.height * -0.01)}px;
      display: block; user-select: none;
    }
    .quote {
      font-family: ${hStack}; font-weight: 700; font-size: ${quoteFontPx}px;
      color: #ffffff; line-height: 1.2; letter-spacing: -0.02em;
      word-break: break-word;
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.025)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: rgba(255,255,255,0.75); line-height: 1.5; font-weight: 400;
    }
    .divider {
      margin: ${Math.round(d.height * 0.03)}px 0 0;
      width: ${fs(d.width, 0.1)}px; height: 3px;
      background: rgba(255,255,255,0.5); border-radius: 2px;
    }
    .footer {
      padding: ${Math.round(d.height * 0.025)}px ${pad}px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0; position: relative; z-index: 1;
      border-top: 1px solid rgba(255,255,255,0.2);
    }
    .hashtags { font-size: ${tagFontPx}px; color: rgba(255,255,255,0.65); font-weight: 500; flex: 1; word-break: break-all; margin-right: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="circle"></div>
    <div class="header">
      <span class="brand">${esc(d.brandName)}</span>
      ${logoBlock(d, logoSize)}
    </div>
    <div class="body">
      <span class="q-mark">"</span>
      <p class="quote">${esc(truncate(d.headline, 180))}</p>
      ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 140))}</p>` : ""}
      <div class="divider"></div>
    </div>
    <div class="footer">
      ${hashLine ? `<span class="hashtags">${hashLine}</span>` : `<span></span>`}
    </div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "quote-card",
  name:        "Quote / Motivation",
  description: "Brand colour background with large centered quote. Perfect for mindset and inspiration.",
  type:        "single_image",
  platforms:   null,
  buildHtml,
}
