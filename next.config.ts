import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Packages that use Node.js APIs must not be bundled for the edge runtime
  serverExternalPackages: ["pg", "bullmq", "ioredis", "@prisma/client"],
};

export default nextConfig;
