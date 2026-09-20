/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): the Wayback Machine's raw (id_) mode
// hands back some archived workbooks still gzip-encoded. Decompress in place
// when the gzip magic (1f 8b) is present; leave other files untouched.
// Usage: node scripts/dev-probes/cr08-indices-a-gunzip.mjs <file> [<file> ...]
import fs from "node:fs";
import zlib from "node:zlib";

for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f);
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const out = zlib.gunzipSync(buf);
    fs.writeFileSync(f, out);
    console.log(`${f}: gunzipped ${buf.length} -> ${out.length} bytes (magic now ${out.slice(0, 2).toString("hex")})`);
  } else {
    console.log(`${f}: not gzip (magic ${buf.slice(0, 2).toString("hex")}), left as is`);
  }
}
