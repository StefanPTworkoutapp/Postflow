import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://postflowsocials.app"),
  // NOTE: deliberately a plain string, not a { default, template } object —
  // every page in this app already composes its own full "... · PostFlow" /
  // "PostFlow — ..." title, so a template here would double up the brand name.
  title: "PostFlow",
  description: "Content planning and scheduling for service businesses",
  // NOTE: favicon.ico / icon.svg / apple-icon.png in this directory are picked
  // up automatically by Next.js's file-based icon convention — no explicit
  // `icons` field needed here. Same for opengraph-image.png / twitter-image.png
  // (file-based convention auto-injects the og:image / twitter:image tags).
  openGraph: {
    title:       "PostFlow",
    description: "Content planning and scheduling for service businesses",
    url:         "https://postflowsocials.app",
    siteName:    "PostFlow",
    type:        "website",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "PostFlow",
    description: "Content planning and scheduling for service businesses",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
