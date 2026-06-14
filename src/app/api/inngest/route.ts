import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { dailyAnalyticsFetch }       from "@/inngest/jobs/dailyAnalyticsFetch"
import { weeklyPerformancePatterns } from "@/inngest/jobs/weeklyPerformancePatterns"
import { weeklyTrendFetch }          from "@/inngest/jobs/weeklyTrendFetch"
import { weeklyTrendEmail }          from "@/inngest/jobs/weeklyTrendEmail"
import { schedulePostReminders }     from "@/inngest/jobs/postReminders"
import { toneLearningLoop }          from "@/inngest/jobs/toneLearningLoop"
import { tagMediaUpload }            from "@/inngest/jobs/tagMediaUpload"
import { nicheResearchSync }         from "@/inngest/jobs/nicheResearchSync"
import { templatePulse }             from "@/inngest/jobs/templatePulse"
import { nicheBenchmarkRefresh }     from "@/inngest/jobs/nicheBenchmarkRefresh"
import { refreshTokens }             from "@/inngest/jobs/refreshTokens"
import { recalibrationCheck }        from "@/inngest/jobs/recalibrationCheck"
import { publishScheduledPost }      from "@/inngest/jobs/publishScheduledPost"
import { evergreenRepurpose }        from "@/inngest/jobs/evergreenRepurpose"
import { postPublishedAnalytics }    from "@/inngest/jobs/postPublishedAnalytics"

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    dailyAnalyticsFetch,
    weeklyPerformancePatterns,
    weeklyTrendFetch,
    weeklyTrendEmail,
    schedulePostReminders,
    toneLearningLoop,
    tagMediaUpload,
    nicheResearchSync,
    templatePulse,
    nicheBenchmarkRefresh,
    refreshTokens,
    recalibrationCheck,
    publishScheduledPost,
    evergreenRepurpose,
    postPublishedAnalytics,
  ],
})
