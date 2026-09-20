// CR08 Phase B: the guard for modules that must never reach a browser bundle
// (the Anthropic client, the document parsers, the storage layer).
//
// The npm `server-only` package is the usual way to say this, and the two
// modules that only ever run inside the app still use it. These three are also
// imported directly by the seed, the smoke suite and the dev probes, which run
// under plain Node where that package resolves to its client build and throws
// on sight. This module says the same thing in a way that is true in every
// runtime: it fails loudly in a browser and is inert on the server.
if (typeof window !== "undefined") {
  throw new Error(
    "This module is server-only: it carries the AI SDK, the document parsers or filesystem access, and must not be imported from a client component."
  );
}

export {};
