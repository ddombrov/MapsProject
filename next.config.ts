import type { NextConfig } from "next";

// The planner is a static site plus Cloudflare Pages Functions (functions/api), so Next only builds the pages.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
