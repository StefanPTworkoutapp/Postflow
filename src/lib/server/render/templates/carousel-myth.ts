/**
 * carousel-myth — Carousel Myth vs. Reality
 * Alternating "myth" (dark/red) and "reality" (brand colour) slides.
 * Perfect for debunking common misconceptions and showing corrections.
 *
 * slideIndex 0        = Hook slide (brand colour, "Let's bust some myths")
 * slideIndex 1, 3, …  = Myth slides (dark red background)
 * slideIndex 2, 4, …  = Reality slides (brand colour)
 * Last slide          = CTA slide
 *
 * Per-slide mediaUrl support:
 *   When a slide has a mediaUrl it renders as a very-low-opacity texture
 *   behind the coloured background, so the myth/reality visual identity is
 *   preserved while the photo adds subtle depth.
 */

import type { TemplateData, TemplateDefinition, SlideContent } from "./types"
import { esc, truncate, fs, fontStack, logoBlock } from "./types"

const MYTH_BG = "#1a0505"

// ── Hook slide ────────────────────────────────────────────────────────────────
function hookSlide(d: TemplateData): string {
  const hStack     = fontStack(d.fontHeading)
  const bStack     = fontStack(d.fontBody)
  const pad        = Math.round(d.width * 0.08)
  const hookFontPx = fs(d.width, 0.075)
  const subFontPx  = fs(d.width, 0.037)
  const nameFontPx = fs(d.width, 0.030)
  const logoSize   = Math.round(d.width * 0.062)
  const total      = d.totalSlides ?? 1

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: ${d.primaryColor};
    display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .grid { position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background-image: linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px);
    background-size: ${Math.round(d.width * 0.08)}px ${Math.round(d.width * 0.08)}px; }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.045)}px ${pad}px; flex-shrink: 0; position: relative; z-index: 1; }
  .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
    color: rgba(255,255,255,0.85); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 0 ${pad}px; position: relative; z-index: 1; }
  .label { font-family: ${bStack}; font-size: ${fs(d.width, 0.028)}px;
    color: rgba(255,255,255,0.65); font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; margin-bottom: ${Math.round(d.height * 0.02)}px; }
  .headline { font-family: ${hStack}; font-weight: 900; font-size: ${hookFontPx}px;
    color: #ffffff; line-height: 1.1; letter-spacing: -0.025em; word-break: break-word; }
  .subtext { margin-top: ${Math.round(d.height * 0.025)}px; font-family: ${bStack};
    font-size: ${subFontPx}px; color: rgba(255,255,255,0.75); line-height: 1.5; }
  .footer { padding: ${Math.round(d.height * 0.025)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; position: relative; z-index: 1; }
  .counter { font-family: ${hStack}; font-size: ${fs(d.width, 0.026)}px;
    color: rgba(255,255,255,0.5); font-weight: 500; }
  .swipe { font-size: ${fs(d.width, 0.036)}px; color: rgba(255,255,255,0.7); }
</style></head><body>
<div class="card">
  <div class="grid"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <span class="label">Myth vs Reality</span>
    <p class="headline">${esc(truncate(d.headline, 140))}</p>
    ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 150))}</p>` : ""}
  </div>
  <div class="footer">
    <span class="counter">1 / ${total}</span>
    <span class="swipe">→</span>
  </div>
</div>
</body></html>`
}

// ── Myth slide ────────────────────────────────────────────────────────────────
function mythSlide(d: TemplateData, slide: SlideContent, slideNum: number): string {
  const hStack      = fontStack(d.fontHeading)
  const bStack      = fontStack(d.fontBody)
  const pad         = Math.round(d.width * 0.075)
  const titleFontPx = fs(d.width, slide.headline.length > 70 ? 0.056 : 0.068)
  const bodyFontPx  = fs(d.width, 0.036)
  const nameFontPx  = fs(d.width, 0.026)
  const logoSize    = Math.round(d.width * 0.055)
  const total       = d.totalSlides ?? 1

  // When an image is provided, render it as a very-low-opacity texture
  // so the dark-red myth identity is preserved
  const bgStyle = slide.mediaUrl
    ? `background: ${MYTH_BG}; position: relative; overflow: hidden;`
    : `background: ${MYTH_BG};`

  const photoOverlay = slide.mediaUrl
    ? `<div style="position:absolute;inset:0;background:url('${slide.mediaUrl}') center/cover;opacity:0.12;z-index:0;"></div>
       <div style="position:absolute;inset:0;background:${MYTH_BG};opacity:0.70;z-index:0;"></div>`
    : ""

  const zIndex = slide.mediaUrl ? "position:relative;z-index:1;" : ""

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; ${bgStyle}
    display: flex; flex-direction: column; }
  .accent-bar { width: 100%; height: ${Math.round(d.height * 0.008)}px; background: #ef4444; flex-shrink: 0; ${zIndex} }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.035)}px ${pad}px; flex-shrink: 0; ${zIndex} }
  .brand { font-family: ${hStack}; font-weight: 600; font-size: ${nameFontPx}px; color: rgba(255,255,255,0.4); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 ${pad}px; ${zIndex} }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: #ef444422; border: 1px solid #ef444455; border-radius: 9999px;
    padding: ${Math.round(d.height * 0.008)}px ${Math.round(d.width * 0.038)}px;
    font-family: ${hStack}; font-weight: 700; font-size: ${fs(d.width, 0.028)}px;
    color: #ef4444; letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: ${Math.round(d.height * 0.025)}px; align-self: flex-start;
  }
  .headline { font-family: ${hStack}; font-weight: 800; font-size: ${titleFontPx}px;
    color: #ffffff; line-height: 1.15; letter-spacing: -0.022em; word-break: break-word; }
  .slide-body { margin-top: ${Math.round(d.height * 0.022)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: rgba(255,255,255,0.65); line-height: 1.55; }
  .footer { padding: ${Math.round(d.height * 0.02)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); ${zIndex} }
  .counter { font-family: ${hStack}; font-size: ${fs(d.width, 0.026)}px; color: rgba(255,255,255,0.3); }
  .next { font-family: ${bStack}; font-size: ${fs(d.width, 0.026)}px;
    color: rgba(255,255,255,0.45); font-style: italic; }
</style></head><body>
<div class="card">
  ${photoOverlay}
  <div class="accent-bar"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <span class="badge">❌ Myth</span>
    <p class="headline">${esc(truncate(slide.headline, 130))}</p>
    ${slide.body ? `<p class="slide-body">${esc(truncate(slide.body, 250))}</p>` : ""}
  </div>
  <div class="footer">
    <span class="counter">${slideNum + 1} / ${total}</span>
    <span class="next">Reality →</span>
  </div>
</div>
</body></html>`
}

// ── Reality slide ─────────────────────────────────────────────────────────────
function realitySlide(d: TemplateData, slide: SlideContent, slideNum: number): string {
  const hStack      = fontStack(d.fontHeading)
  const bStack      = fontStack(d.fontBody)
  const pad         = Math.round(d.width * 0.075)
  const titleFontPx = fs(d.width, slide.headline.length > 70 ? 0.056 : 0.068)
  const bodyFontPx  = fs(d.width, 0.036)
  const nameFontPx  = fs(d.width, 0.026)
  const logoSize    = Math.round(d.width * 0.055)
  const total       = d.totalSlides ?? 1

  const bgStyle = slide.mediaUrl
    ? `background: ${d.primaryColor}; position: relative; overflow: hidden;`
    : `background: ${d.primaryColor};`

  const photoOverlay = slide.mediaUrl
    ? `<div style="position:absolute;inset:0;background:url('${slide.mediaUrl}') center/cover;opacity:0.14;z-index:0;"></div>
       <div style="position:absolute;inset:0;background:${d.primaryColor};opacity:0.72;z-index:0;"></div>`
    : ""

  const zIndex = slide.mediaUrl ? "position:relative;z-index:1;" : ""

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; ${bgStyle}
    display: flex; flex-direction: column; }
  .accent-bar { width: 100%; height: ${Math.round(d.height * 0.008)}px;
    background: rgba(255,255,255,0.3); flex-shrink: 0; ${zIndex} }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.035)}px ${pad}px; flex-shrink: 0; ${zIndex} }
  .brand { font-family: ${hStack}; font-weight: 600; font-size: ${nameFontPx}px; color: rgba(255,255,255,0.6); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 ${pad}px; ${zIndex} }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 9999px;
    padding: ${Math.round(d.height * 0.008)}px ${Math.round(d.width * 0.038)}px;
    font-family: ${hStack}; font-weight: 700; font-size: ${fs(d.width, 0.028)}px;
    color: #ffffff; letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: ${Math.round(d.height * 0.025)}px; align-self: flex-start;
  }
  .headline { font-family: ${hStack}; font-weight: 800; font-size: ${titleFontPx}px;
    color: #ffffff; line-height: 1.15; letter-spacing: -0.022em; word-break: break-word; }
  .slide-body { margin-top: ${Math.round(d.height * 0.022)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: rgba(255,255,255,0.85); line-height: 1.55; }
  .footer { padding: ${Math.round(d.height * 0.02)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.15); ${zIndex} }
  .counter { font-family: ${hStack}; font-size: ${fs(d.width, 0.026)}px; color: rgba(255,255,255,0.5); }
</style></head><body>
<div class="card">
  ${photoOverlay}
  <div class="accent-bar"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <span class="badge">✅ Reality</span>
    <p class="headline">${esc(truncate(slide.headline, 130))}</p>
    ${slide.body ? `<p class="slide-body">${esc(truncate(slide.body, 250))}</p>` : ""}
  </div>
  <div class="footer">
    <span class="counter">${slideNum + 1} / ${total}</span>
  </div>
</div>
</body></html>`
}

// ── CTA slide ─────────────────────────────────────────────────────────────────
function ctaSlide(d: TemplateData): string {
  const hStack      = fontStack(d.fontHeading)
  const bStack      = fontStack(d.fontBody)
  const pad         = Math.round(d.width * 0.08)
  const titleFontPx = fs(d.width, 0.068)
  const bodyFontPx  = fs(d.width, 0.036)
  const btnFontPx   = fs(d.width, 0.034)
  const nameFontPx  = fs(d.width, 0.028)
  const logoSize    = Math.round(d.width * 0.062)
  const total       = d.totalSlides ?? 1

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: #0f172a;
    display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .glow-outer { position: absolute; width: 90%; height: 50%; border-radius: 50%;
    background: radial-gradient(ellipse, ${d.primaryColor}20 0%, transparent 70%);
    top: 20%; left: 50%; transform: translateX(-50%); }
  .glow-inner { position: absolute; width: 55%; height: 32%; border-radius: 50%;
    background: radial-gradient(ellipse, ${d.primaryColor}35 0%, transparent 70%);
    top: 28%; left: 50%; transform: translateX(-50%); }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.04)}px ${pad}px; flex-shrink: 0; position: relative; z-index: 1; }
  .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px; color: rgba(255,255,255,0.5); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 0 ${pad}px; text-align: center; position: relative; z-index: 1; }
  .emoji { font-size: ${fs(d.width, 0.1)}px; margin-bottom: ${Math.round(d.height * 0.022)}px; line-height: 1; }
  .cta-title { font-family: ${hStack}; font-weight: 900; font-size: ${titleFontPx}px;
    color: #ffffff; line-height: 1.15; letter-spacing: -0.02em; }
  .cta-body { margin-top: ${Math.round(d.height * 0.018)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: rgba(255,255,255,0.65); line-height: 1.5; }
  .btn { margin-top: ${Math.round(d.height * 0.04)}px;
    display: inline-block;
    padding: ${Math.round(d.height * 0.015)}px ${Math.round(d.width * 0.08)}px;
    background: ${d.primaryColor}; color: #fff; border-radius: 9999px;
    font-family: ${hStack}; font-weight: 700; font-size: ${btnFontPx}px; }
  .footer { padding: ${Math.round(d.height * 0.02)}px ${pad}px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative; z-index: 1;
    border-top: 1px solid rgba(255,255,255,0.08); }
  .counter { font-family: ${hStack}; font-size: ${fs(d.width, 0.025)}px; color: rgba(255,255,255,0.3); }
</style></head><body>
<div class="card">
  <div class="glow-outer"></div>
  <div class="glow-inner"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <span class="emoji">🔥</span>
    <p class="cta-title">${esc(d.cta ?? "Now you know the truth.")}</p>
    <p class="cta-body">Save this so you never fall for these myths again.</p>
    ${d.cta ? `<span class="btn">${esc(d.cta)}</span>` : ""}
  </div>
  <div class="footer">
    <span class="counter">${total} / ${total}</span>
  </div>
</div>
</body></html>`
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildHtml(d: TemplateData): string {
  const slides = d.slideContent ?? []
  const idx    = d.slideIndex ?? 0
  const total  = d.totalSlides ?? 1

  if (idx === 0) return hookSlide(d)
  if (idx === total - 1) return ctaSlide(d)

  const slide = slides[idx] ?? { headline: d.headline, body: d.subtext }

  // Odd content indices (1, 3, 5…) = myth; even content (2, 4, 6…) = reality
  return idx % 2 === 1
    ? mythSlide(d, slide, idx)
    : realitySlide(d, slide, idx)
}

export const definition: TemplateDefinition = {
  slug:        "carousel-myth",
  name:        "Carousel — Myth vs. Reality",
  description: "Alternating dark/brand-colour slides contrasting myths with facts.",
  type:        "carousel",
  platforms:   null,
  buildHtml,
  /** 1 hook + myth/reality pairs + 1 CTA */
  slideCount:  (n) => 1 + (n * 2) + 1,
}
