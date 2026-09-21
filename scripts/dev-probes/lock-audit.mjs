/* eslint-disable no-console */
/**
 * Does the lockfile give a Linux production install everything the build
 * needs, and nothing it must refuse?
 *
 * A dry run only reports the difference from the node_modules already on this
 * machine, so it cannot answer "would a clean production install contain X".
 * The lockfile can: an entry marked `dev: true` is omitted by --omit=dev, and
 * an entry with a cpu or os constraint is skipped unless the platform matches.
 */
import fs from "node:fs";
import path from "node:path";

const lock = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8"));
const pkgs = lock.packages ?? {};
const root = pkgs[""] ?? {};

const entry = (name) => pkgs[`node_modules/${name}`];

let problems = 0;
const say = (ok, text, detail = "") => {
  if (!ok) problems++;
  console.log(`${ok ? "ok  " : "FAIL"} ${text}${detail ? `  ${detail}` : ""}`);
};

console.log("== the build must survive --omit=dev on Linux ==\n");
for (const name of [
  "typescript",
  "tailwindcss",
  "@tailwindcss/postcss",
  "postcss",
  "@types/react",
  "@types/react-dom",
  "@types/node",
  "@types/d3-zoom",
  "next",
  "react",
]) {
  const e = entry(name);
  if (!e) {
    say(false, `${name} is in the lockfile`, "missing");
    continue;
  }
  say(!e.dev, `${name}@${e.version} survives --omit=dev`, e.dev ? "marked dev" : "");
}

console.log("\n== nothing wasm32-only may be required ==\n");
/* A package that lists wasm32 ALONGSIDE x64 is fine: libsql does, and installs
   happily on x64. The one that breaks an install is a package whose only cpu
   is wasm32 and which something requires rather than merely offers. */
const wasmOnly = Object.entries(pkgs).filter(
  ([, m]) => (m.cpu ?? []).length === 1 && m.cpu[0] === "wasm32"
);
for (const [key, m] of wasmOnly) {
  const name = m.name ?? key.replace(/^.*node_modules\//, "");
  say(
    Boolean(m.optional),
    `${name}@${m.version} is optional, so x64 skips it`,
    m.optional ? "" : "REQUIRED: this is the EBADPLATFORM"
  );
}
if (!wasmOnly.length) console.log("ok   no wasm32-only package is in the lockfile");

console.log("\n== the declared Linux binaries are pinned and optional ==\n");
for (const [name, version] of Object.entries(root.optionalDependencies ?? {})) {
  const e = entry(name);
  const exact = /^\d+\.\d+\.\d+$/.test(version);
  say(Boolean(e), `${name} resolves`, e ? `${e.version}` : "missing from the lockfile");
  if (e) {
    say(exact && e.version === version, `${name} is pinned to the resolved version`, `declared ${version}, locked ${e.version}`);
    say(Boolean(e.optional), `${name} is optional`, e.optional ? "" : "would break a Windows install");
    say(!(e.libc ?? []).includes("musl"), `${name} is the glibc build`, (e.libc ?? []).join("|") || "");
  }
}

console.log("\n== the shims are nobody's requirement ==\n");
/* They stay in the lockfile, because their parent packages offer them as
   optional dependencies and npm records every option it might take. What must
   not happen is this project asking for them itself: that is what npm refuses
   on x64, and it is how the deployment build died. */
for (const name of ["@tailwindcss/oxide-wasm32-wasi", "@unrs/resolver-binding-wasm32-wasi"]) {
  const declared =
    (root.dependencies ?? {})[name] ??
    (root.devDependencies ?? {})[name] ??
    (root.optionalDependencies ?? {})[name];
  say(!declared, `${name} is not declared in package.json`, declared ? `declared as ${declared}` : "");
  const e = entry(name);
  say(
    !e || Boolean(e.optional),
    `${name} is optional where it appears`,
    e ? (e.optional ? "optional, offered by its parent" : "REQUIRED") : "absent"
  );
}

console.log(problems ? `\n${problems} problem(s)` : "\nthe lockfile is fit for Linux and for this laptop");
process.exit(problems ? 1 : 0);
