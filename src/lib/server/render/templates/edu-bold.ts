/**
 * edu-bold — Education Bold
 * Large bold text on white. Accent bar top + bottom stripe.
 * Great for facts, tips, and educational single-image posts.
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, tint, fontStack, logoBlock, styleInterp } from "./types"

export function buildHtml(d: TemplateData): string {
  const style  = d.templateStyle ?? 50
  // Padding: more breathing room at minimal, tighter at bold
  const pad    = Math.round(d.width * styleInterp(style, 0.085, 0.055))
  const hStack = fontStack(d.fontHeading)
  const bStack = fontStack(d.fontBody)

  // Weight and letter-spacing scale with style
  const headlineWeight = style < 34 ? 700 : style < 67 ? 800 : 900
  const headlineLS     = `${styleInterp(style, -0.01, -0.04).toFixed(3)}em`

  const headlineFontPx = fs(d.width, d.headline.length > 80 ? 0.054 : 0.068)
  const subtextFontPx  = fs(d.width, 0.038)
  const tagFontPx      = fs(d.width, 0.028)
  const nameFontPx     = fs(d.width, 0.033)
  const ctaFontPx      = fs(d.width, 0.033)
  const logoSize       = Math.round(d.width * 0.07)
  const barPx          = Math.round(d.height * 0.011)
  const accentBg       = tint(d.primaryColor, "12")

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
    }
    .bar { width: 100%; height: ${barPx}px; background: ${d.primaryColor}; flex-shrink: 0; }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: ${Math.round(d.width * 0.04)}px ${pad}px;
      flex-shrink: 0;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px; color: ${d.primaryColor}; letter-spacing: -0.02em; }
    .body {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: ${Math.round(d.height * 0.04)}px ${pad}px;
    }
    .accent-rule { width: ${fs(d.width, 0.09)}px; height: 5px; background: ${d.primaryColor}; border-radius: 3px; margin-bottom: ${Math.round(d.height * 0.025)}px; }
    .headline {
      font-family: ${hStack}; font-weight: ${headlineWeight}; font-size: ${headlineFontPx}px;
      color: #0f172a; line-height: 1.15; letter-spacing: ${headlineLS};
      word-break: break-word;
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.022)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: #475569; line-height: 1.55; font-weight: 400;
    }
    .cta {
      margin-top: ${Math.round(d.height * 0.035)}px;
      display: inline-block;
      padding: ${Math.round(d.height * 0.014)}px ${Math.round(d.width * 0.048)}px;
      background: ${d.primaryColor}; color: #fff;
      border-radius: 9999px;
      font-family: ${hStack}; font-weight: 700; font-size: ${ctaFontPx}px;
      align-self: flex-start; letter-spacing: 0.01em;
    }
    .footer {
      padding: ${Math.round(d.height * 0.018)}px ${pad}px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0; background: ${accentBg};
      border-top: 2px solid ${d.primaryColor}22;
    }
    .hashtags { font-size: ${tagFontPx}px; color: ${d.primaryColor}; font-weight: 500; flex: 1; margin-right: 12px; word-break: break-all; }
    .bar-bottom { width: 100%; height: ${Math.round(barPx * 0.6)}px; background: ${d.secondaryColor}; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="header">
      <span class="brand">${esc(d.brandName)}</span>
      ${logoBlock(d, logoSize)}
    </div>
    <div class="body">
      <div class="accent-rule"></div>
      <p class="headline">${esc(truncate(d.headline, 160))}</p>
      ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 220))}</p>` : ""}
      ${d.cta ? `<span class="cta">${esc(d.cta)}</span>` : ""}
    </div>
    <div class="footer">
      ${hashLine ? `<span class="hashtags">${hashLine}</span>` : `<span></span>`}
    </div>
    <div class="bar-bottom"></div>
  </div>
</body>
</html>`
}

export const definition: TemplateDefinition = {
  slug:        "edu-bold",
  name:        "Education — Bold",
  description: "Large bold text on white. Great for facts, tips, and educational points.",
  type:        "single_image",
  platforms:   null,
  buildHtml,
}
