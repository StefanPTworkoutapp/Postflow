/**
 * linkedin-insight — LinkedIn Insight Card
 * Professional, document-style single-image card. Restrained brand palette
 * (tinted header strip, not a loud gradient), a headline framed like a pull
 * quote/stat, and 2–3 lines of supporting insight text. Built to look native
 * to a LinkedIn feed of screenshots and slide decks — calmer and more
 * text-dense than the consumer-facing templates.
 *
 * Layout (landscape 1200×627):
 *   • Header strip — tinted brand background, logo + brand name
 *   • Insight headline — bold, dark slate, framed by a left accent rule
 *     (pull-quote treatment)
 *   • Supporting text — 2–3 lines below the headline
 *   • Footer — brand name + optional hashtags, quiet divider
 */

import type { TemplateData, TemplateDefinition } from "./types"
import { esc, truncate, fs, tint, fontStack, logoBlock, styleInterp } from "./types"

export function buildHtml(d: TemplateData): string {
  const style  = d.templateStyle ?? 50
  const hStack = fontStack(d.fontHeading)
  const bStack = fontStack(d.fontBody)
  const pad    = Math.round(d.width * 0.07)

  // Restrained weight range — LinkedIn stays professional even at "bold"
  const headlineWeight = style < 50 ? 700 : 800
  const headlineLS     = `${styleInterp(style, -0.005, -0.02).toFixed(3)}em`

  const headlineFontPx = fs(d.width, d.headline.length > 90 ? 0.05 : 0.062)
  const subtextFontPx  = fs(d.width, 0.032)
  const nameFontPx     = fs(d.width, 0.028)
  const tagFontPx      = fs(d.width, 0.024)
  const logoSize       = Math.round(d.width * 0.052)
  const headerBg       = tint(d.primaryColor, "0d")
  const ruleWidth      = 5

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
      background: #ffffff;
      display: flex; flex-direction: column;
    }
    .header {
      display: flex; align-items: center; gap: 12px;
      padding: ${Math.round(d.height * 0.032)}px ${pad}px;
      background: ${headerBg};
      border-bottom: 1px solid ${d.primaryColor}22;
      flex-shrink: 0;
    }
    .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px; color: #1e293b; letter-spacing: -0.01em; }
    .body {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 0 ${pad}px;
    }
    .frame {
      display: flex; gap: ${Math.round(d.width * 0.022)}px;
    }
    .accent-rule {
      width: ${ruleWidth}px; border-radius: 3px; background: ${d.primaryColor};
      flex-shrink: 0;
    }
    .text-col { display: flex; flex-direction: column; }
    .headline {
      font-family: ${hStack}; font-weight: ${headlineWeight}; font-size: ${headlineFontPx}px;
      color: #0f172a; line-height: 1.22; letter-spacing: ${headlineLS};
      word-break: break-word;
    }
    .subtext {
      margin-top: ${Math.round(d.height * 0.022)}px;
      font-family: ${bStack}; font-size: ${subtextFontPx}px;
      color: #475569; line-height: 1.55; font-weight: 400;
      word-break: break-word;
    }
    .footer {
      padding: ${Math.round(d.height * 0.022)}px ${pad}px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0; border-top: 1px solid #e2e8f0;
    }
    .hashtags { font-size: ${tagFontPx}px; color: ${d.primaryColor}; font-weight: 500; word-break: break-all; }
    .brand-footer { font-size: ${tagFontPx}px; color: #94a3b8; font-weight: 400; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${logoBlock(d, logoSize)}
      <span class="brand">${esc(d.brandName)}</span>
    </div>
    <div class="body">
      <div class="frame">
        <div class="accent-rule"></div>
        <div class="text-col">
          <p class="headline">${esc(truncate(d.headline, 140))}</p>
          ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 220))}</p>` : ""}
        </div>
      </div>
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
  slug:        "linkedin-insight",
  name:        "LinkedIn — Insight",
  description: "Professional document-style card: tinted header strip, pull-quote headline framing, restrained brand palette.",
  type:        "single_image",
  platforms:   ["linkedin"],
  buildHtml,
}
