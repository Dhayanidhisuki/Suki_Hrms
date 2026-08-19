import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare quick tunnels change hostname each restart; allow /_next + HMR
  // in `next dev` so browsers don't get bare "Unauthorized" (breaks sign-in).
  allowedDevOrigins: ["*.trycloudflare.com"],
  env: {
    TOOL_DOCS_ROOT: path.join(process.cwd(), "storage", "tool-docs"),
  },
  images: {
    dangerouslyAllowSVG: true,
  },
  async headers() {
    return [
      {
        source: "/favicon.ico",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        source: "/suki-favicon.ico",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        source: "/suki-favicon-32.png",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
