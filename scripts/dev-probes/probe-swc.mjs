// Probes Next's SWC binding loader to see exactly why it fails and whether
// the WASM fallback is considered.
process.env.NEXT_PRIVATE_DEBUG = "1";
try {
  const swc = await import("next/dist/build/swc/index.js");
  const bindings = await swc.loadBindings();
  console.log("loaded bindings:", bindings ? "OK" : "null", "wasm:", Boolean(bindings?.isWasm));
} catch (e) {
  console.error("loadBindings failed:", e?.message);
  const causes = e?.cause;
  if (Array.isArray(causes)) {
    for (const c of causes) console.error(" cause:", c?.message || c);
  } else if (causes) {
    console.error(" cause:", causes?.message || causes);
  }
}
