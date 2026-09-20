// CR08 Phase B: `server-only` guards the AI client, the parsers and the
// storage layer against ever reaching a browser bundle. Under vitest there is
// no bundler to make that distinction, and the package's own client build
// throws on import, so the tests resolve it to this empty module instead.
export {};
