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
  serverExternalPackages: ["@libsql/client", "pg", "unpdf", "mammoth", "xlsx"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  // CR08: the dev-tools badge sat over the rail's Settings row in screenshots
  devIndicators: false,
  /* CR08 Phase A, security headers. The app is same-origin only: it loads no
     third-party script, frames nothing and is framed by nothing. The CSP is
     deliberately not set here because Next injects inline bootstrap scripts
     and the dev server needs eval; it belongs to the deployment, and this is
     recorded in DECISIONS. */
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          /* Nothing in an internal knowledge base belongs in a search index,
             and a public deployment is one crawl away from proving it. The
             header covers every response; public/robots.txt covers the
             crawlers that ask first. */
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
          },
        ],
      },
      {
        // uploads and generated documents are never a page
        source: "/api/v1/:path*/download",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
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

/* CR08 Phase B: `npm run analyze` writes the treemaps to .next/analyze/. The
   plugin is a dev dependency, so a production install without it still builds. */
let withAnalyzer = (config) => config;
if (process.env.ANALYZE === "true") {
  try {
    const mod = await import("@next/bundle-analyzer");
    withAnalyzer = mod.default({ enabled: true, openAnalyzer: false });
  } catch {
    console.warn("@next/bundle-analyzer is not installed; building without it");
  }
}

export default withAnalyzer(nextConfig);
