/**
 * Branded card HTML template.
 * All styling is inline so Puppeteer renders it without any external CSS.
 */

export interface CardData {
  platform:       string
  caption:        string
  hashtags:       string[]
  cta:            string | null
  brandName:      string
  logoUrl:        string | null
  primaryColor:   string   // hex e.g. "#6366f1"
  secondaryColor: string
  fontHeading:    string   // e.g. "Montserrat"
  fontBody:       string   // e.g. "Inter"
  /** Platform dimensions in px */
  width:          number
  height:         number
}

/** Clamp caption to a readable length for the card */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + "…"
}

/** Escape HTML special chars */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildCardHtml(d: CardData): string {
  const truncatedCaption = truncate(d.caption, 280)
  const hashtagLine = d.hashtags.slice(0, 8).map(h => `#${esc(h)}`).join(" ")

  // Derive a light tinted background from the primary color
  const accentAlpha = "22"            // ~14% opacity overlay
  const accentBg    = `${d.primaryColor}${accentAlpha}`

  // Font size scales with card dimensions
  const baseFontPx   = Math.round(d.width * 0.038)   // ~41px at 1080
  const captionFontPx = Math.min(baseFontPx, 44)
  const tagFontPx     = Math.round(captionFontPx * 0.55)
  const nameFontPx    = Math.round(captionFontPx * 0.65)
  const ctaFontPx     = Math.round(captionFontPx * 0.72)
  const logoSize      = Math.round(d.width * 0.075)  // ~81px at 1080
  const accentBarPx   = Math.round(d.height * 0.012) // ~16px at 1350

  // Map brand font name to the closest system/generic fallback
  // No network requests — Puppeteer renders instantly
  const headingStack = `'${d.fontHeading}', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`
  const bodyStack    = `'${d.fontBody}', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`

  const logoBlock = d.logoUrl
    ? `<img src="${esc(d.logoUrl)}" alt="${esc(d.brandName)}" style="width:${logoSize}px;height:${logoSize}px;object-fit:contain;border-radius:8px;" />`
    : `<div style="width:${logoSize}px;height:${logoSize}px;border-radius:8px;background:${d.primaryColor};display:flex;align-items:center;justify-content:center;color:#fff;font-family:${headingStack};font-weight:700;font-size:${Math.round(logoSize * 0.5)}px;">${esc(d.brandName[0] ?? "B")}</div>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }

    .card {
      width:      ${d.width}px;
      height:     ${d.height}px;
      background: #ffffff;
      display:    flex;
      flex-direction: column;
      font-family: ${bodyStack};
      position:   relative;
    }

    /* Top accent bar */
    .accent-bar {
      width:      100%;
      height:     ${accentBarPx}px;
      background: ${d.primaryColor};
      flex-shrink: 0;
    }

    /* Header row: brand name + logo */
    .header {
      display:         flex;
      align-items:     center;
      justify-content: space-between;
      padding:         ${Math.round(d.width * 0.04)}px ${Math.round(d.width * 0.055)}px;
      flex-shrink:     0;
    }
    .brand-name {
      font-family:  ${headingStack};
      font-weight:  700;
      font-size:    ${nameFontPx}px;
      color:        ${d.primaryColor};
      letter-spacing: -0.02em;
    }

    /* Caption area — fills remaining space */
    .body {
      flex:       1;
      display:    flex;
      flex-direction: column;
      justify-content: center;
      padding:    0 ${Math.round(d.width * 0.07)}px;
      background: ${accentBg};
    }
    .caption {
      font-family:  ${bodyStack};
      font-weight:  500;
      font-size:    ${captionFontPx}px;
      line-height:  1.5;
      color:        #1a1a2e;
      white-space:  pre-line;
      word-break:   break-word;
    }

    /* CTA pill */
    .cta {
      margin-top:   ${Math.round(d.height * 0.025)}px;
      display:      inline-block;
      padding:      ${Math.round(d.height * 0.016)}px ${Math.round(d.width * 0.05)}px;
      background:   ${d.primaryColor};
      color:        #ffffff;
      border-radius: 9999px;
      font-family:  ${headingStack};
      font-weight:  600;
      font-size:    ${ctaFontPx}px;
      letter-spacing: 0.01em;
      align-self:   flex-start;
    }

    /* Footer row: hashtags + platform label */
    .footer {
      padding:         ${Math.round(d.height * 0.02)}px ${Math.round(d.width * 0.055)}px;
      display:         flex;
      align-items:     center;
      justify-content: space-between;
      flex-shrink:     0;
      border-top:      2px solid ${d.primaryColor}33;
    }
    .hashtags {
      font-size:    ${tagFontPx}px;
      color:        ${d.primaryColor};
      font-weight:  500;
      flex:         1;
      word-break:   break-all;
      margin-right: ${Math.round(d.width * 0.03)}px;
    }
    .platform-label {
      font-size:    ${tagFontPx}px;
      color:        #9ca3af;
      font-weight:  400;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      flex-shrink:  0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="accent-bar"></div>

    <div class="header">
      <span class="brand-name">${esc(d.brandName)}</span>
      ${logoBlock}
    </div>

    <div class="body">
      <p class="caption">${esc(truncatedCaption)}</p>
      ${d.cta ? `<span class="cta">${esc(d.cta)}</span>` : ""}
    </div>

    <div class="footer">
      ${hashtagLine ? `<span class="hashtags">${hashtagLine}</span>` : `<span></span>`}
      <span class="platform-label">${esc(d.platform)}</span>
    </div>
  </div>
</body>
</html>`
}
