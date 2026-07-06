import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Pin the workspace root — repo has multiple lockfiles above this dir.
  turbopack: { root: __dirname },
};

export default nextConfig;
