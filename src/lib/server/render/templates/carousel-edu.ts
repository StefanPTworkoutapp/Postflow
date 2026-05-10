/**
 * carousel-edu — Carousel Educational
 * Hook slide → numbered content slides → CTA slide.
 * Best for how-to guides, educational carousels.
 *
 * slideIndex 0         = Hook slide (full brand colour, big headline)
 * slideIndex 1…N-1     = Content slides (white, numbered, body text)
 * slideIndex N (last)  = CTA slide (dark, save/follow CTA)
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: ${d.primaryColor};
    display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .wave { position: absolute; bottom: 0; left: 0; width: 100%; height: 35%;
    background: rgba(0,0,0,0.15); clip-path: ellipse(60% 100% at 50% 100%); }
  .dots-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: ${Math.round(d.width * 0.055)}px ${Math.round(d.width * 0.055)}px; }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.045)}px ${pad}px; flex-shrink: 0; position: relative; z-index: 1; }
  .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
    color: rgba(255,255,255,0.85); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 0 ${pad}px; position: relative; z-index: 1; }
  .swipe-label { font-family: ${bStack}; font-size: ${fs(d.width, 0.028)}px;
    color: rgba(255,255,255,0.65); font-weight: 500; letter-spacing: 0.08em;
    text-transform: uppercase; margin-bottom: ${Math.round(d.height * 0.02)}px; }
  .headline { font-family: ${hStack}; font-weight: ${hookWeight}; font-size: ${hookFontPx}px;
    color: #ffffff; line-height: 1.1; letter-spacing: ${hookLS}; word-break: break-word; }
  .subtext { margin-top: ${Math.round(d.height * 0.025)}px; font-family: ${bStack};
    font-size: ${subFontPx}px; color: rgba(255,255,255,0.78); line-height: 1.5; }
  .footer { padding: ${Math.round(d.height * 0.025)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; position: relative; z-index: 1; }
  .counter { font-family: ${hStack}; font-size: ${counterFontPx}px;
    color: rgba(255,255,255,0.55); font-weight: 500; }
  .swipe-arrow { font-size: ${fs(d.width, 0.038)}px; color: rgba(255,255,255,0.7); }
</style></head><body>
<div class="card">
  <div class="dots-bg"></div>
  <div class="wave"></div>
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

// ── Content slide ─────────────────────────────────────────────────────────────
function contentSlide(d: TemplateData, slide: SlideContent, slideNum: number): string {
  const style        = d.templateStyle ?? 50
  const hStack       = fontStack(d.fontHeading)
  const bStack       = fontStack(d.fontBody)
  const pad          = Math.round(d.width * styleInterp(style, 0.09, 0.065))
  const numFontPx    = fs(d.width, 0.065)
  const titleFontPx  = fs(d.width, slide.headline.length > 60 ? 0.052 : 0.062)
  const bodyFontPx   = fs(d.width, 0.037)
  const nameFontPx   = fs(d.width, 0.026)
  const counterFontPx = fs(d.width, 0.026)
  const logoSize     = Math.round(d.width * 0.055)
  const accentBg     = tint(d.primaryColor, "0a")
  const total        = d.totalSlides ?? 1

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${d.width}px; height: ${d.height}px; overflow: hidden; }
  .card { width: ${d.width}px; height: ${d.height}px; background: #ffffff;
    display: flex; flex-direction: column; }
  .accent-top { width: 100%; height: ${Math.round(d.height * 0.008)}px;
    background: ${d.primaryColor}; flex-shrink: 0; }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.035)}px ${pad}px; flex-shrink: 0;
    border-bottom: 1px solid #f1f5f9; }
  .brand { font-family: ${hStack}; font-weight: 600; font-size: ${nameFontPx}px;
    color: #94a3b8; letter-spacing: -0.01em; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: ${Math.round(d.height * 0.05)}px ${pad}px; }
  .num-row { display: flex; align-items: flex-start; gap: ${Math.round(d.width * 0.04)}px; }
  .num { font-family: ${hStack}; font-weight: 900; font-size: ${numFontPx}px;
    color: ${d.primaryColor}; line-height: 1; flex-shrink: 0; opacity: 0.9; }
  .content-wrap { flex: 1; }
  .slide-title { font-family: ${hStack}; font-weight: ${style < 34 ? 700 : style < 67 ? 800 : 900}; font-size: ${titleFontPx}px;
    color: #0f172a; line-height: 1.18; letter-spacing: ${styleInterp(style, -0.01, -0.03).toFixed(3)}em; word-break: break-word; }
  .slide-body { margin-top: ${Math.round(d.height * 0.02)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: #475569; line-height: 1.6; }
  .footer { padding: ${Math.round(d.height * 0.02)}px ${pad}px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; background: ${accentBg}; border-top: 1px solid #f1f5f9; }
  .counter { font-family: ${hStack}; font-size: ${counterFontPx}px;
    color: #94a3b8; font-weight: 500; }
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
        ${slide.body ? `<p class="slide-body">${esc(truncate(slide.body, 280))}</p>` : ""}
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
  .glow { position: absolute; width: 80%; height: 50%; border-radius: 50%;
    background: radial-gradient(ellipse, ${d.primaryColor}25 0%, transparent 70%);
    top: 20%; left: 50%; transform: translateX(-50%); }
  .header { display: flex; align-items: center; justify-content: space-between;
    padding: ${Math.round(d.width * 0.04)}px ${pad}px; flex-shrink: 0; position: relative; z-index: 1; }
  .brand { font-family: ${hStack}; font-weight: 700; font-size: ${nameFontPx}px;
    color: rgba(255,255,255,0.5); }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;
    padding: 0 ${pad}px; text-align: center; position: relative; z-index: 1; }
  .emoji { font-size: ${fs(d.width, 0.12)}px; margin-bottom: ${Math.round(d.height * 0.025)}px; }
  .cta-title { font-family: ${hStack}; font-weight: 900; font-size: ${ctaTitlePx}px;
    color: #ffffff; line-height: 1.15; letter-spacing: -0.02em; }
  .cta-body { margin-top: ${Math.round(d.height * 0.02)}px; font-family: ${bStack};
    font-size: ${bodyFontPx}px; color: rgba(255,255,255,0.65); line-height: 1.5; }
  .btn { margin-top: ${Math.round(d.height * 0.04)}px;
    display: inline-block;
    padding: ${Math.round(d.height * 0.016)}px ${Math.round(d.width * 0.07)}px;
    background: ${d.primaryColor}; color: #fff; border-radius: 9999px;
    font-family: ${hStack}; font-weight: 700; font-size: ${btnFontPx}px; }
  .footer { padding: ${Math.round(d.height * 0.022)}px ${pad}px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative; z-index: 1;
    border-top: 1px solid rgba(255,255,255,0.08); }
  .counter { font-family: ${hStack}; font-size: ${fs(d.width, 0.026)}px;
    color: rgba(255,255,255,0.35); font-weight: 500; }
</style></head><body>
<div class="card">
  <div class="glow"></div>
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

  // Slide 0 = hook
  if (idx === 0) return hookSlide(d)

  // Last slide = CTA
  const isLast = d.totalSlides !== undefined && idx === d.totalSlides - 1
  if (isLast) {
    const ctaContent: SlideContent = slides[idx] ?? {
      headline: d.cta ?? "Save this for later!",
      body:     "Follow for more tips like this.",
      isCTA:    true,
    }
    return ctaSlide(d, ctaContent)
  }

  // Content slide
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
