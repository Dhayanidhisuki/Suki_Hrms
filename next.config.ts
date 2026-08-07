import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare quick tunnels change hostname each restart; allow /_next + HMR
  // in `next dev` so browsers don't get bare "Unauthorized" (breaks sign-in).
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
