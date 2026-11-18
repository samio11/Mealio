import type { NextConfig } from "next";

/**
 * The browser talks only to this Next.js origin. Everything under `/api/*` is
 * proxied to the Express server, which keeps Better-Auth session cookies
 * same-origin (no CORS / SameSite headaches) in both dev and production.
 */
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiTarget}/health`,
      },
    ];
  },
};

export default nextConfig;
