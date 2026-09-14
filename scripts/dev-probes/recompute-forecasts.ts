/* eslint-disable no-console */
// One-shot: recompute all official forecasts with mock explanations.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { getSetting, setSetting } = await import("../../src/server/settings");
  const ai = await getSetting<{ mockMode?: boolean }>("ai", {});
  const wasMock = ai.mockMode === true;
  if (!wasMock) await setSetting("ai", { ...ai, mockMode: true });
  try {
    const { computeAllForecasts } = await import("../../src/server/indices/compute");
    console.log("recomputed:", await computeAllForecasts());
  } finally {
    if (!wasMock) await setSetting("ai", { ...ai, mockMode: false });
  }
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
