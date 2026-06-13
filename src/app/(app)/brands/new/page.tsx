import type { Metadata } from "next"
import { AddBrandWizard } from "./AddBrandWizard"

export const metadata: Metadata = { title: "PostFlow · Add brand" }

export default function NewBrandPage() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <AddBrandWizard />
    </div>
  )
}
