import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // COOP/COEP headers required for ffmpeg.wasm (SharedArrayBuffer).
  // Scoped to /upload only — applying globally would break OAuth redirects
  // and Supabase Auth iframes on other routes.
  async headers() {
    return [
      {
        source: "/upload/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ]
  },
  // Turbopack is the default dev bundler in Next.js 16 — declare it explicitly
  // so the webpack config below doesn't trigger a conflict warning.
  turbopack: {},
  // webpack config applies to `next build` (production) only.
  // Excludes Puppeteer's native binaries from the server bundle.
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "puppeteer-core",
        "@sparticuz/chromium-min",
      ]
    }
    return config
  },
};

export default nextConfig;
