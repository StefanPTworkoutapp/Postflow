/**
 * Shared PostFlow brand header/footer for transactional emails.
 *
 * Email clients (Outlook, older Gmail) do not reliably render inline SVG or
 * relative image paths, so the logo is served as a hosted PNG at an absolute
 * URL (public/postflow-logo-icon.png, deployed at postflowsocials.app).
 *
 * Keeping this in one module means every email (trend intelligence, reminder
 * post, margin report) shows the same mark + wordmark + footer instead of
 * each template rolling its own ad-hoc header.
 */

/** Absolute base URL for hosted email assets — email clients cannot resolve relative paths. */
export const EMAIL_ASSETS_BASE_URL = "https://postflowsocials.app"

/**
 * Single sender identity for ALL transactional email.
 * The Resend sending domain must be VERIFIED or delivery silently fails —
 * postflowsocials.app is registered in Resend but pending DNS verification,
 * so POSTFLOW_EMAIL_FROM (Vercel env) points at a verified domain until then.
 * Once postflowsocials.app verifies in Resend, remove the env var and this
 * default takes over. Never hardcode a from address at a call site.
 */
export const EMAIL_FROM = process.env.POSTFLOW_EMAIL_FROM ?? "PostFlow <hello@postflowsocials.app>"

export const EMAIL_LOGO_ICON_URL = `${EMAIL_ASSETS_BASE_URL}/postflow-logo-icon.png`

/**
 * Renders a compact brand header row: icon mark + "PostFlow" wordmark, above
 * whatever title/subtitle a given template wants to render underneath it.
 * Uses table-safe inline styles (no flex/grid — Outlook's Word engine ignores them).
 */
export function buildEmailBrandHeader(opts: { background?: string; textColor?: string } = {}): string {
  const background = opts.background ?? "#1B2B4B"
  const textColor   = opts.textColor ?? "#ffffff"
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};">
      <tr>
        <td style="padding:16px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:8px;vertical-align:middle;">
                <img src="${EMAIL_LOGO_ICON_URL}" width="20" height="20" alt="PostFlow" style="display:block;border-radius:5px;" />
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:14px;font-weight:700;color:${textColor};letter-spacing:-0.2px;">PostFlow</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
}

/** Consistent footer across all transactional emails — logo + wordmark + legal line. */
export function buildEmailFooter(opts: { extra?: string } = {}): string {
  return `
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px auto;">
        <tr>
          <td style="padding-right:6px;vertical-align:middle;">
            <img src="${EMAIL_LOGO_ICON_URL}" width="14" height="14" alt="PostFlow" style="display:block;border-radius:3px;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:12px;font-weight:700;color:#1B2B4B;">PostFlow</span>
          </td>
        </tr>
      </table>
      ${opts.extra ?? ""}
      <p style="margin:4px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">
        PostFlow · <a href="${EMAIL_ASSETS_BASE_URL}" style="color:#94a3b8;">postflowsocials.app</a>
      </p>
    </div>`
}
