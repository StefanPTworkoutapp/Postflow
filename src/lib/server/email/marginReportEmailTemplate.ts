/**
 * Builds the HTML for the monthly cost & margin admin email.
 * Plain TypeScript (no React Email dependency) — same approach as
 * trendEmailTemplate.ts. Reuses MarginReport from marginReport.ts so there is
 * exactly one place that computes the numbers (the admin page reads the same
 * shape) — see src/lib/server/admin/marginReport.ts.
 */

import type { MarginReport } from "@/lib/server/admin/marginReport"

function formatEur(n: number): string {
  const sign = n < 0 ? "-" : ""
  return `${sign}&euro;${Math.abs(n).toFixed(2)}`
}

export function buildMarginReportEmailHtml(report: MarginReport): string {
  const top20 = [...report.companies]
    .sort((a, b) => b.thisMonth.aiCostEur - a.thisMonth.aiCostEur)
    .slice(0, 20)

  const negativeMargin = report.companies.filter(c => c.thisMonth.marginEur < 0)

  const rowsHtml = top20
    .map(c => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">${c.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#6b7280;text-transform:capitalize;">${c.plan}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">${formatEur(c.thisMonth.revenueEur)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;color:#7c3aed;">${formatEur(c.thisMonth.aiCostEur)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;color:${c.thisMonth.marginEur < 0 ? "#ef4444" : "#059669"};">
          ${formatEur(c.thisMonth.marginEur)}
        </td>
      </tr>`)
    .join("")

  const negativeHtml = negativeMargin.length
    ? `
      <div style="margin:24px 0;padding:14px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
        <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#b91c1c;">
          ${negativeMargin.length} compan${negativeMargin.length === 1 ? "y" : "ies"} running at a loss this month
        </p>
        <p style="margin:0;font-size:13px;color:#7f1d1d;">
          ${negativeMargin.slice(0, 10).map(c => c.name).join(", ")}${negativeMargin.length > 10 ? `, +${negativeMargin.length - 10} more` : ""}
        </p>
      </div>`
    : `
      <div style="margin:24px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#065f46;">No companies running at a loss this month.</p>
      </div>`

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="padding:32px 32px 16px 32px;">
        <h1 style="margin:0 0 4px 0;font-size:20px;color:#111827;">PostFlow monthly cost &amp; margin</h1>
        <p style="margin:0;font-size:14px;color:#6b7280;">${report.month}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
          <tr>
            <td style="padding:12px;background:#f9fafb;border-radius:8px 0 0 8px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:#111827;">${formatEur(report.totals.thisMonth.revenueEur)}</div>
              <div style="font-size:11px;color:#6b7280;">Total MRR</div>
            </td>
            <td style="padding:12px;background:#f9fafb;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:#7c3aed;">${formatEur(report.totals.thisMonth.aiCostEur)}</div>
              <div style="font-size:11px;color:#6b7280;">Total AI cost</div>
            </td>
            <td style="padding:12px;background:#f9fafb;border-radius:0 8px 8px 0;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:${report.totals.thisMonth.marginEur < 0 ? "#ef4444" : "#059669"};">${formatEur(report.totals.thisMonth.marginEur)}</div>
              <div style="font-size:11px;color:#6b7280;">Overall margin</div>
            </td>
          </tr>
        </table>

        ${negativeHtml}

        <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#111827;">Top 20 companies by AI cost this month</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Company</th>
              <th style="text-align:left;padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Plan</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Revenue</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">AI cost</th>
              <th style="text-align:right;padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Margin</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="5" style="padding:12px 8px;font-size:13px;color:#9ca3af;">No billed or AI-usage activity this month.</td></tr>`}
          </tbody>
        </table>

        <p style="margin:24px 0 0 0;font-size:11px;color:#9ca3af;">
          AI cost converted from USD to EUR at a fixed approximate rate (see src/lib/server/billing/aiBudget.ts).
          Full breakdown with lifetime figures at /admin.
        </p>
      </td>
    </tr>
    <tr><td style="padding:24px 32px;">&nbsp;</td></tr>
  </table>
</body>
</html>`
}
