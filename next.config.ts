import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['undici'],
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
