import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

// Validate env at build time (allows importing TypeScript env file)
const jiti = createJiti(fileURLToPath(import.meta.url));
jiti("./src/env");

const nextConfig: NextConfig = {
  // Standalone output and transpile required packages for some deploy targets
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  experimental: {
    reactCompiler: true,
  },
};

export default nextConfig;
