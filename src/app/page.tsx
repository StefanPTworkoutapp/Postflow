import { redirect } from "next/navigation"

// Root "/" always redirects. Middleware handles session-based routing:
// logged in → /dashboard, logged out → /login.
export default function RootPage() {
  redirect("/dashboard")
}
