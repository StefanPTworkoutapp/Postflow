import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { dailyAnalyticsFetch }       from "@/inngest/jobs/dailyAnalyticsFetch"
import { weeklyPerformancePatterns } from "@/inngest/jobs/weeklyPerformancePatterns"
import { weeklyTrendFetch }          from "@/inngest/jobs/weeklyTrendFetch"
import { weeklyTrendEmail }          from "@/inngest/jobs/weeklyTrendEmail"
import { schedulePostReminders }     from "@/inngest/jobs/postReminders"
import { toneLearningLoop }          from "@/inngest/jobs/toneLearningLoop"

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    dailyAnalyticsFetch,
    weeklyPerformancePatterns,
    weeklyTrendFetch,
    weeklyTrendEmail,
    schedulePostReminders,
    toneLearningLoop,
  ],
})
