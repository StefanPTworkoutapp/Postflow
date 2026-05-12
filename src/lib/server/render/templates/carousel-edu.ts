/**
 * carousel-edu — Carousel Educational
 * Hook slide → numbered content slides → CTA slide.
 * Best for how-to guides, educational carousels.
 *
 * slideIndex 0         = Hook slide (full brand colour, big headline)
 * slideIndex 1…N-1     = Content slides (white, numbered, body text)
 * slideIndex N (last)  = CTA slide (dark, save/follow CTA)
 *
 * Per-slide mediaUrl support:
 *   Content slides with a mediaUrl render in a split layout:
 *   top image band (~38% height) + text content below.
 *   Slides without mediaUrl use the original centred number layout.
 */

import type { TemplateData, TemplateDefinition, SlideContent } from "./types"
import { esc, truncate, fs, tint, fontStack, logoBlock, styleInterp } from "./types"

// ── Hook slide ────────────────────────────────────────────────────────────────
function hookSlide(d: TemplateData): string {
  const style      = d.templateStyle ?? 50
  const hStack     = fontStack(d.fontHeading)
  const bStack     = fontStack(d.fontBody)
  const pad        = Math.round(d.width * styleInterp(style, 0.09, 0.065))
  const hookWeight = style < 34 ? 700 : style < 67 ? 800 : 900
  const hookLS     = `${styleInterp(style, -0.01, -0.04).toFixed(3)}em`
  const hookFontPx = fs(d.width, d.headline.length > 70 ? 0.068 : 0.085)
  const subFontPx  = fs(d.width, 0.038)
  const nameFontPx = fs(d.width, 0.030)
  const logoSize   = Math.round(d.width * 0.062)
  const counterFontPx = fs(d.width, 0.026)
  const total      = d.totalSlides ?? 1
  const dotSpacing = Math.round(d.width * 0.055)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: ${d.primaryColor};
    display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .dots-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1.5px, transparent 1.5px);
    background-size: ${dotSpacing}px ${dotSpacing}px; z-index: 0; }
  .wave-bottom { position: absolute; bottom: -2%; left: -5%; width: 110%; height: 42%;
    background: rgba(0,0,0,0.18); border-radius: 50% 50% 0 0 / 60% 60% 0 0; z-index: 0; }
  .wave-mid { position: absolute; bottom: -5%; left: -5%; width: 110%; height: 32%;
    background: rgba(0,0,0,0.10); border-radius: 50% 50% 0 0 / 60% 60% 0 0; z-index: 0; }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.045)}px ${pad}px; flex-shrink: 0; position: relative; z-index: 1; }
  .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
    color: rgba(255,255,255,0.85); letter-spacing: -0.01em; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 0 ${pad}px; position: relative; z-index: 1; }
  .swipe-label { font-family: ${bStack}; font-size: ${fs(d.width, 0.026)}px;
    color: rgba(255,255,255,0.60); font-weight: 600; letter-spacing: 0.10em;
    text-transform: uppercase; margin-bottom: ${Math.round(d.height * 0.022)}px; }
  .headline { font-family: ${hStack}; font-weight: ${hookWeight}; font-size: ${hookFontPx}px;
    color: #ffffff; line-height: 1.1; letter-spacing: ${hookLS}; word-break: break-word; }
  .subtext { margin-top: ${Math.round(d.height * 0.028)}px; font-family: ${bStack};
    font-size: ${subFontPx}px; color: rgba(255,255,255,0.75); line-height: 1.55; }
  .footer { padding: ${Math.round(d.height * 0.028)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; position: relative; z-index: 1; }
  .counter { font-family: ${hStack}; font-size: ${counterFontPx}px;
    color: rgba(255,255,255,0.50); font-weight: 600; letter-spacing: 0.02em; }
  .swipe-arrow { font-size: ${fs(d.width, 0.038)}px; color: rgba(255,255,255,0.65); }
</style></head><body>
<div class="card">
  <div class="dots-bg"></div>
  <div class="wave-bottom"></div>
  <div class="wave-mid"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <span class="swipe-label">Swipe to learn →</span>
    <p class="headline">${esc(truncate(d.headline, 150))}</p>
    ${d.subtext ? `<p class="subtext">${esc(truncate(d.subtext, 160))}</p>` : ""}
  </div>
  <div class="footer">
    <span class="counter">1 / ${total}</span>
    <span class="swipe-arrow">→</span>
  </div>
</div>
</body></html>`
}

// ── Content slide — text-only layout ─────────────────────────────────────────
function contentSlideText(d: TemplateData, slide: SlideContent, slideNum: number): string {
  const style         = d.templateStyle ?? 50
  const hStack        = fontStack(d.fontHeading)
  const bStack        = fontStack(d.fontBody)
  const pad           = Math.round(d.width * styleInterp(style, 0.09, 0.065))
  const numFontPx     = fs(d.width, 0.072)
  const titleFontPx   = fs(d.width, slide.headline.length > 60 ? 0.054 : 0.064)
  const bodyFontPx    = fs(d.width, 0.038)
  const nameFontPx    = fs(d.width, 0.026)
  const counterFontPx = fs(d.width, 0.026)
  const logoSize      = Math.round(d.width * 0.055)
  const accentBg      = tint(d.primaryColor, "0c")
  const total         = d.totalSlides ?? 1

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: #ffffff;
    display: flex; flex-direction: column; }
  .accent-top { width: 100%; height: ${Math.round(d.height * 0.007)}px;
    background: ${d.primaryColor}; flex-shrink: 0; }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.035)}px ${pad}px; flex-shrink: 0;
    border-bottom: 1px solid #f1f5f9; }
  .brand { font-family: ${hStack}; font-weight: 600; font-size: ${nameFontPx}px;
    color: #94a3b8; letter-spacing: -0.01em; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: ${Math.round(d.height * 0.06)}px ${pad}px; }
  .num-row { display: flex; align-items: flex-start; gap: ${Math.round(d.width * 0.038)}px; }
  .num { font-family: ${hStack}; font-weight: 900; font-size: ${numFontPx}px;
    color: ${d.primaryColor}; line-height: 1; flex-shrink: 0; opacity: 0.85;
    letter-spacing: -0.04em; }
  .content-wrap { flex: 1; min-width: 0; }
  .slide-title { font-family: ${hStack};
    font-weight: ${style < 34 ? 700 : style < 67 ? 800 : 900}; font-size: ${titleFontPx}px;
    color: #0f172a; line-height: 1.18;
    letter-spacing: ${styleInterp(style, -0.01, -0.03).toFixed(3)}em; word-break: break-word; }
  .slide-body { margin-top: ${Math.round(d.height * 0.022)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: #475569; line-height: 1.6; }
  .footer { padding: ${Math.round(d.height * 0.022)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; background: ${accentBg}; border-top: 1px solid #f1f5f9; }
  .counter { font-family: ${hStack}; font-size: ${counterFontPx}px;
    color: #94a3b8; font-weight: 600; }
  .progress { display: flex; gap: 5px; }
  .dot { width: ${Math.round(d.width * 0.018)}px; height: 4px; border-radius: 2px; }
  .dot-active { background: ${d.primaryColor}; }
  .dot-inactive { background: #e2e8f0; }
</style></head><body>
<div class="card">
  <div class="accent-top"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <div class="num-row">
      <span class="num">${String(slideNum).padStart(2, "0")}</span>
      <div class="content-wrap">
        <p class="slide-title">${esc(truncate(slide.headline, 120))}</p>
        ${slide.body ? `<p class="slide-body">${esc(truncate(slide.body, 300))}</p>` : ""}
      </div>
    </div>
  </div>
  <div class="footer">
    <span class="counter">${slideNum + 1} / ${total}</span>
    <div class="progress">
      ${Array.from({ length: Math.min(total, 8) }, (_, i) =>
        `<div class="dot ${i === slideNum ? "dot-active" : "dot-inactive"}"></div>`
      ).join("")}
    </div>
  </div>
</div>
</body></html>`
}

// ── Content slide — image + text layout ──────────────────────────────────────
/**
 * When a slide has a mediaUrl (already resolved to a base64 data URI by renderPost.ts),
 * the layout switches to:
 *   • Top image band (38 % of height) with a white gradient fade at the bottom.
 *   • Thin brand-colour accent bar.
 *   • Compact header (brand name + logo).
 *   • Body: slide number + headline + body text.
 *   • Footer: counter + progress dots.
 */
function contentSlideMedia(d: TemplateData, slide: SlideContent, slideNum: number): string {
  const style         = d.templateStyle ?? 50
  const hStack        = fontStack(d.fontHeading)
  const bStack        = fontStack(d.fontBody)
  const pad           = Math.round(d.width * styleInterp(style, 0.09, 0.065))
  const imageBandH    = Math.round(d.height * 0.38)
  const numFontPx     = fs(d.width, 0.064)
  const titleFontPx   = fs(d.width, slide.headline.length > 60 ? 0.050 : 0.060)
  const bodyFontPx    = fs(d.width, 0.036)
  const nameFontPx    = fs(d.width, 0.026)
  const counterFontPx = fs(d.width, 0.026)
  const logoSize      = Math.round(d.width * 0.050)
  const accentBg      = tint(d.primaryColor, "0c")
  const total         = d.totalSlides ?? 1

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: #ffffff;
    display: flex; flex-direction: column; }
  .media-band { width: 100%; height: ${imageBandH}px; flex-shrink: 0; position: relative;
    background: url('${slide.mediaUrl}') center / cover no-repeat; }
  .media-gradient { position: absolute; bottom: 0; left: 0; right: 0;
    height: ${Math.round(imageBandH * 0.45)}px;
    background: linear-gradient(to bottom, transparent, #ffffff); }
  .accent-top { width: 100%; height: ${Math.round(d.height * 0.007)}px;
    background: ${d.primaryColor}; flex-shrink: 0; }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.030)}px ${pad}px; flex-shrink: 0;
    border-bottom: 1px solid #f1f5f9; }
  .brand { font-family: ${hStack}; font-weight: 600; font-size: ${nameFontPx}px;
    color: #94a3b8; letter-spacing: -0.01em; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: ${Math.round(d.height * 0.035)}px ${pad}px; }
  .num-row { display: flex; align-items: flex-start; gap: ${Math.round(d.width * 0.038)}px; }
  .num { font-family: ${hStack}; font-weight: 900; font-size: ${numFontPx}px;
    color: ${d.primaryColor}; line-height: 1; flex-shrink: 0; opacity: 0.85;
    letter-spacing: -0.04em; }
  .content-wrap { flex: 1; min-width: 0; }
  .slide-title { font-family: ${hStack};
    font-weight: ${style < 34 ? 700 : style < 67 ? 800 : 900}; font-size: ${titleFontPx}px;
    color: #0f172a; line-height: 1.18;
    letter-spacing: ${styleInterp(style, -0.01, -0.03).toFixed(3)}em; word-break: break-word; }
  .slide-body { margin-top: ${Math.round(d.height * 0.018)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: #475569; line-height: 1.55; }
  .footer { padding: ${Math.round(d.height * 0.020)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; background: ${accentBg}; border-top: 1px solid #f1f5f9; }
  .counter { font-family: ${hStack}; font-size: ${counterFontPx}px;
    color: #94a3b8; font-weight: 600; }
  .progress { display: flex; gap: 5px; }
  .dot { width: ${Math.round(d.width * 0.018)}px; height: 4px; border-radius: 2px; }
  .dot-active { background: ${d.primaryColor}; }
  .dot-inactive { background: #e2e8f0; }
</style></head><body>
<div class="card">
  <div class="media-band">
    <div class="media-gradient"></div>
  </div>
  <div class="accent-top"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <div class="num-row">
      <span class="num">${String(slideNum).padStart(2, "0")}</span>
      <div class="content-wrap">
        <p class="slide-title">${esc(truncate(slide.headline, 110))}</p>
        ${slide.body ? `<p class="slide-body">${esc(truncate(slide.body, 220))}</p>` : ""}
      </div>
    </div>
  </div>
  <div class="footer">
    <span class="counter">${slideNum + 1} / ${total}</span>
    <div class="progress">
      ${Array.from({ length: Math.min(total, 8) }, (_, i) =>
        `<div class="dot ${i === slideNum ? "dot-active" : "dot-inactive"}"></div>`
      ).join("")}
    </div>
  </div>
</div>
</body></html>`
}

// ── Content slide dispatcher ──────────────────────────────────────────────────
function contentSlide(d: TemplateData, slide: SlideContent, slideNum: number): string {
  return slide.mediaUrl
    ? contentSlideMedia(d, slide, slideNum)
    : contentSlideText(d, slide, slideNum)
}

// ── CTA slide ─────────────────────────────────────────────────────────────────
function ctaSlide(d: TemplateData, slide: SlideContent): string {
  const hStack     = fontStack(d.fontHeading)
  const bStack     = fontStack(d.fontBody)
  const pad        = Math.round(d.width * 0.08)
  const ctaTitlePx = fs(d.width, 0.068)
  const bodyFontPx = fs(d.width, 0.036)
  const btnFontPx  = fs(d.width, 0.036)
  const nameFontPx = fs(d.width, 0.030)
  const logoSize   = Math.round(d.width * 0.062)
  const total      = d.totalSlides ?? 1

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: #0f172a;
    display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .glow-outer { position: absolute; width: 90%; height: 55%; border-radius: 50%;
    background: radial-gradient(ellipse, ${d.primaryColor}1a 0%, transparent 70%);
    top: 15%; left: 50%; transform: translateX(-50%); }
  .glow-inner { position: absolute; width: 55%; height: 35%; border-radius: 50%;
    background: radial-gradient(ellipse, ${d.primaryColor}30 0%, transparent 70%);
    top: 25%; left: 50%; transform: translateX(-50%); }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.04)}px ${pad}px; flex-shrink: 0; position: relative; z-index: 1; }
  .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
    color: rgba(255,255,255,0.45); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 0 ${pad}px; text-align: center; position: relative; z-index: 1; }
  .emoji { font-size: ${fs(d.width, 0.11)}px; margin-bottom: ${Math.round(d.height * 0.028)}px;
    line-height: 1; }
  .cta-title { font-family: ${hStack}; font-weight: 900; font-size: ${ctaTitlePx}px;
    color: #ffffff; line-height: 1.15; letter-spacing: -0.025em; }
  .cta-body { margin-top: ${Math.round(d.height * 0.022)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: rgba(255,255,255,0.60); line-height: 1.5; }
  .btn { margin-top: ${Math.round(d.height * 0.042)}px;
    display: inline-block;
    padding: ${Math.round(d.height * 0.016)}px ${Math.round(d.width * 0.08)}px;
    background: ${d.primaryColor}; color: #fff; border-radius: 9999px;
    font-family: ${hStack}; font-weight: 700; font-size: ${btnFontPx}px;
    letter-spacing: -0.01em; }
  .footer { padding: ${Math.round(d.height * 0.022)}px ${pad}px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative; z-index: 1;
    border-top: 1px solid rgba(255,255,255,0.08); }
  .counter { font-family: ${hStack}; font-size: ${fs(d.width, 0.026)}px;
    color: rgba(255,255,255,0.30); font-weight: 500; }
</style></head><body>
<div class="card">
  <div class="glow-outer"></div>
  <div class="glow-inner"></div>
  <div class="header">
    <span class="brand">${esc(d.brandName)}</span>
    ${logoBlock(d, logoSize)}
  </div>
  <div class="body">
    <span class="emoji">🔖</span>
    <p class="cta-title">${esc(truncate(slide.headline, 100))}</p>
    ${slide.body ? `<p class="cta-body">${esc(truncate(slide.body, 160))}</p>` : ""}
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

  if (idx === 0) return hookSlide(d)

  const isLast = d.totalSlides !== undefined && idx === d.totalSlides - 1
  if (isLast) {
    const ctaContent: SlideContent = slides[idx] ?? {
      headline: d.cta ?? "Save this for later!",
      body:     "Follow for more tips like this.",
      isCTA:    true,
    }
    return ctaSlide(d, ctaContent)
  }

  // Content slide — dispatches to media or text layout based on slide.mediaUrl
  const slide: SlideContent = slides[idx] ?? { headline: d.headline, body: d.subtext }
  return contentSlide(d, slide, idx)
}

export const definition: TemplateDefinition = {
  slug:        "carousel-edu",
  name:        "Carousel — Educational",
  description: "Hook slide + numbered content slides + CTA slide. Best for how-to and education.",
  type:        "carousel",
  platforms:   null,
  buildHtml,
  /** Always: 1 hook + N content + 1 CTA */
  slideCount:  (n) => n + 2,
}
