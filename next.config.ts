import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "drizzle-orm",
      "next-intl",
    ],
  },
};

export default withNextIntl(nextConfig);
