// Plain-JS config. Two machine-policy workarounds are embedded here:
// 1. The native SWC/oxide bindings are blocked by Application Control; Next and
//    Tailwind fall back to their installed WASM packages automatically.
// 2. next-intl's createNextIntlPlugin() top-level-requires @swc/core (native,
//    blocked) for its optional message extractor. We skip the plugin and set the
//    only thing it needs for our usage: the `next-intl/config` alias pointing at
//    src/i18n/request.ts, for both webpack and turbopack.
import path from "node:path";

const REQUEST_CONFIG = "./src/i18n/request.ts";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "unpdf", "mammoth", "xlsx"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingExcludes: {
    "*": ["./sources/**", "./data/**"],
  },
  turbopack: {
    resolveAlias: {
      "next-intl/config": REQUEST_CONFIG,
    },
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["next-intl/config"] = path.resolve(
      config.context ?? process.cwd(),
      REQUEST_CONFIG
    );
    return config;
  },
};

export default nextConfig;
