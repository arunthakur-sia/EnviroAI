/* eslint-disable no-console */
/**
 * Every package in the lockfile that carries an os/cpu/libc constraint, with
 * the version the lockfile resolved. This is the list a cross-platform build
 * has to think about: the wasm shims that must not be required on Linux, and
 * the linux-x64-gnu binaries that must be available there.
 *   node scripts/dev-probes/platform-packages.mjs [filter]
 */
import fs from "node:fs";
import path from "node:path";

const filter = process.argv[2] ?? "";
const lock = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8"));
const pkgs = lock.packages ?? {};

const rows = [];
for (const [key, meta] of Object.entries(pkgs)) {
  if (!key) continue;
  if (!meta.os && !meta.cpu && !meta.libc) continue;
  const name = meta.name ?? key.replace(/^.*node_modules\//, "");
  rows.push({
    name,
    version: meta.version ?? "",
    os: (meta.os ?? []).join("|"),
    cpu: (meta.cpu ?? []).join("|"),
    libc: (meta.libc ?? []).join("|"),
    optional: Boolean(meta.optional),
    dev: Boolean(meta.dev),
  });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

const show = rows.filter((r) => !filter || r.name.includes(filter));
console.log(`${show.length} of ${rows.length} platform-specific packages\n`);
console.log("name".padEnd(46) + "version".padEnd(12) + "os".padEnd(10) + "cpu".padEnd(10) + "libc".padEnd(8) + "flags");
for (const r of show) {
  const flags = [r.optional ? "optional" : "", r.dev ? "dev" : ""].filter(Boolean).join(",") || "required";
  console.log(
    r.name.padEnd(46) + r.version.padEnd(12) + (r.os || "-").padEnd(10) + (r.cpu || "-").padEnd(10) + (r.libc || "-").padEnd(8) + flags
  );
}

/* What a Linux x64 glibc install would need: for each family that has a
   linux-x64-gnu (or linux-x64) member, report the resolved version. */
console.log("\nlinux x64 gnu members present in the lockfile:");
const linux = rows.filter(
  (r) => /linux/.test(r.name) && /x64/.test(r.name) && (!r.libc || r.libc.includes("glibc") || r.name.endsWith("-gnu") || !/musl/.test(r.name))
);
for (const r of linux) console.log(`  "${r.name}": "${r.version}",`);

console.log("\nwasm members (must never be a hard requirement on Linux):");
for (const r of rows.filter((r) => /wasm/.test(r.name))) {
  console.log(`  ${r.name}@${r.version}  cpu=${r.cpu || "-"} ${r.dev ? "(dev)" : ""} ${r.optional ? "(optional)" : "(required)"}`);
}
