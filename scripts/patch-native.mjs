// This machine's Application Control policy blocks some native .node binaries
// (@next/swc, @tailwindcss/oxide, unrs-resolver). Next and Tailwind fall back to
// WASM automatically once their wasm packages are installed; unrs-resolver's
// loader never tries its wasi binding on win32, so we patch its final throw to
// attempt the wasi binding first. Idempotent; run after every npm install.
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), "node_modules", "unrs-resolver", "index.js");
try {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("wasm32-wasi fallback (nexus patch)")) {
    console.log("unrs-resolver already patched");
  } else {
    const needle = "throw new Error(`Failed to load native binding`)";
    if (!src.includes(needle)) {
      console.error("patch-native: expected throw not found; unrs-resolver layout changed");
      process.exit(0);
    }
    const replacement = `// wasm32-wasi fallback (nexus patch): native .node blocked by machine policy
try {
  nativeBinding = require('@unrs/resolver-binding-wasm32-wasi')
} catch (e) {
  loadErrors.push(e)
}
if (!nativeBinding) {
  ${needle}
}`;
    src = src.replace(needle, replacement);
    fs.writeFileSync(file, src);
    console.log("unrs-resolver patched for wasi fallback");
  }
} catch (e) {
  console.error("patch-native failed:", e?.message);
}
