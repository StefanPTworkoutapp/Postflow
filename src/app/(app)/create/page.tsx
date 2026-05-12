/**
 * /create — Smart Video Builder (Clip Forge)
 *
 * Multi-step wizard for building branded short-form videos from raw clips.
 *
 * Steps:
 *   0. Upload clips
 *   1. Goal + Platform
 *   2. Music pick (after AI analysis)
 *   3. Rendering (polls Shotstack)
 *   4. Preview + Approve/Reject + Schedule
 *
 * Server component: auth guard + brand check.
 * All wizard state is client-side.
 */

import { redirect }         from "next/navigation"
import { getBrand }         from "@/lib/server/brand/getBrand"
import { CreateClient }     from "./CreateClient"

export default async function CreatePage() {
  const brand = await getBrand()
  if (!brand) redirect("/onboarding")

  void brand  // guard: ensures brand exists before rendering
  return <CreateClient />
}
