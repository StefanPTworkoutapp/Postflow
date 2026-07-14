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
import { clipForgeLearningLoop }     from "@/inngest/jobs/clipForgeLearningLoop"
import { feedImportOnConnect }       from "@/inngest/jobs/feedImportOnConnect"
import { feedImportNightly }         from "@/inngest/jobs/feedImportNightly"
import { weeklyCalendarReoptimize }  from "@/inngest/jobs/weeklyCalendarReoptimize"
import { generateCalendarJob }       from "@/inngest/jobs/generateCalendarJob"
import { renderCarouselJob }         from "@/inngest/jobs/renderCarouselJob"
import { renderVariantsJob }         from "@/inngest/jobs/renderVariantsJob"
import { monthlyMarginEmail }        from "@/inngest/jobs/monthlyMarginEmail"

// Carousel/variant renders do real Puppeteer work synchronously inside an
// Inngest step, invoked through this route — same maxDuration the old
// blocking render routes declared (render-carousel, render-variants).
export const maxDuration = 120
export const runtime     = "nodejs"

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
    clipForgeLearningLoop,
    feedImportOnConnect,
    feedImportNightly,
    weeklyCalendarReoptimize,
    generateCalendarJob,
    renderCarouselJob,
    renderVariantsJob,
    monthlyMarginEmail,
  ],
})
