import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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
