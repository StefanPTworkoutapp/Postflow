import { getBrand } from "@/lib/server/brand/getBrand"
import { getOrCreateAccount } from "@/lib/server/accounts/getOrCreateAccount"
import { OnboardingWizard } from "./OnboardingWizard"

export default async function OnboardingPage() {
  // Ensure account row exists
  await getOrCreateAccount()

  const brand = await getBrand()

  return <OnboardingWizard existingBrand={brand} />
}
