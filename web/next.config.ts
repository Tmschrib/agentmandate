import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
