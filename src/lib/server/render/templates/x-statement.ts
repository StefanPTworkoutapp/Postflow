/**
 * x-statement — X (Twitter) Statement Card
 * Native to X, not a resized IG card: near-black background, one huge bold
 * statement, a tight kicker line, and a small brand handle mark in the
 * corner. No hashtag footer, no CTA pill, no decorative photo treatment —
 * X posts are read in a fast-scrolling feed of mostly-text tweets, so the
 * card has to win on a single glance: starker and higher-contrast than the
 * multi-platform templates.
 *
 * Layout (landscape 1200×675):
 *   • Kicker label — top left, small, brand-colour, uppercase
 *   • Statement headline — huge, centered vertically, fills most of the card
 *   • Brand handle + logo mark — bottom left, small and quiet
 *   • Accent rule — thin brand-colour line under the kicker
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, fontStack, logoBlock, styleInterp } from "./types"

export function buildHtml(d: TemplateData): string {
  const style  = d.templateStyle ?? 50
  const hStack = fontStack(d.fontHeading)
  const bStack = fontStack(d.fontBody)
  const pad    = Math.round(d.width * 0.065)

  // Bold at every setting — X statements read starkest with heavier weight,
  // style just tightens tracking as it climbs toward "expressive".
  const headlineWeight = style < 50 ? 800 : 900
  const headlineLS     = `${styleInterp(style, -0.015, -0.035).toFixed(3)}em`

  const headlineFontPx = fs(d.width, d.headline.length > 70 ? 0.062 : 0.08)
  const kickerFontPx   = fs(d.width, 0.027)
  const nameFontPx     = fs(d.width, 0.028)
  const logoSize       = Math.round(d.width * 0.05)
  const ruleWidth      = Math.round(d.width * 0.06)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
    .card {
      width: ${d.width}px; height: ${d.height}px;
      background: #050505;
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    .top {
      padding: ${Math.round(d.height * 0.08)}px ${pad}px 0;
      flex-shrink: 0;
    }
    .kicker {
      font-family: ${bStack}; font-weight: 700; font-size: ${kickerFontPx}px;
      color: ${d.accentColor}; letter-spacing: 0.14em; text-transform: uppercase;
    }
    .rule {
      margin-top: ${Math.round(d.height * 0.02)}px;
      width: ${ruleWidth}px; height: 4px;
      background: ${d.accentColor}; border-radius: 2px;
    }
    .body {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 0 ${pad}px;
    }
    .headline {
      font-family: ${hStack}; font-weight: ${headlineWeight}; font-size: ${headlineFontPx}px;
      color: #ffffff; line-height: 1.08; letter-spacing: ${headlineLS};
      word-break: break-word;
    }
    .footer {
      display: flex; align-items: center; gap: 10px;
      padding: 0 ${pad}px ${Math.round(d.height * 0.075)}px;
      flex-shrink: 0;
    }
    .handle {
      font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
      color: rgba(255,255,255,0.55); letter-spacing: -0.01em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <span class="kicker">Statement</span>
      <div class="rule"></div>
    </div>
    <div class="body">
      <p class="headline">${esc(truncate(d.headline, 120))}</p>
    </div>
    <div class="footer">
      ${logoBlock(d, logoSize)}
      <span class="handle">${esc(d.brandName)}</span>
    </div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "x-statement",
  name:        "X — Statement",
  description: "Near-black, one bold statement, a tight kicker line. Native to X's fast text feed — starker than the multi-platform cards.",
  type:        "single_image",
  platforms:   ["x"],
  buildHtml,
}
