/**
 * /stories — Stories & Reels quick creation page.
 *
 * Single file upload → AI generates caption + hashtags → pick template →
 * preview → schedule to Buffer or download.
 *
 * Server component: auth guard + brand check.
 * All wizard state is client-side in StoriesClient.
 */

import { redirect }      from "next/navigation"
import { getBrand }      from "@/lib/server/brand/getBrand"
import { StoriesClient } from "./StoriesClient"

export default async function StoriesPage() {
  const brand = await getBrand()
  if (!brand) redirect("/onboarding")

  void brand  // guard: ensures brand exists before rendering
  return <StoriesClient />
}
