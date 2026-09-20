/* eslint-disable no-console */
// CR08 Phase B: the bundle report. Windows PowerShell has no inline env
// prefix, so this sets ANALYZE and runs the production build; the treemaps
// land in .next/analyze/.
import { spawnSync } from "node:child_process";

const res = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  cwd: process.cwd(),
  env: { ...process.env, ANALYZE: "true" },
});
if (res.status === 0) console.log("\nreports written to .next/analyze/");
process.exit(res.status ?? 1);
