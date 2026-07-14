/**
 * Monthly cost & margin email — runs 1st of the month, 07:00 UTC.
 *
 * Renders the same margin table as the /admin dashboard "Company margins"
 * section (top 20 companies by AI cost + totals + negative-margin flags) and
 * emails it to Stefan. Reuses getMarginReport() — no duplicate query logic,
 * see src/lib/server/admin/marginReport.ts.
 */

import { inngest } from "../client"
import { Resend } from "resend"
import { getMarginReport } from "@/lib/server/admin/marginReport"
import { buildMarginReportEmailHtml } from "@/lib/server/email/marginReportEmailTemplate"

// Lazy init — avoids throwing at build time when env vars are absent
function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

const ADMIN_EMAIL = "info@mindyourbodypt.nl"

export const monthlyMarginEmail = inngest.createFunction(
  {
    id:       "monthly-margin-email",
    name:     "Monthly Cost & Margin Email",
    // 1st of the month, 07:00 UTC
    triggers: [{ cron: "0 7 1 * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const report = await step.run("build-margin-report", async () => getMarginReport())

    const result: { sent: boolean; error?: string } = await step.run("send-email", async () => {
      const html = buildMarginReportEmailHtml(report)
      const { error } = await getResend().emails.send({
        from:    "PostFlow <onboarding@resend.dev>",
        to:      ADMIN_EMAIL,
        subject: `PostFlow monthly cost & margin — ${report.month}`,
        html,
      })
      if (error) return { sent: false, error: error.message }
      return { sent: true }
    })

    return {
      success:          result.sent,
      month:            report.month,
      companiesCount:   report.companies.length,
      overallMarginEur: report.totals.thisMonth.marginEur,
      error:            result.error,
    }
  }
)
