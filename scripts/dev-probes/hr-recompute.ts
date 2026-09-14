/* eslint-disable no-console */
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
async function main() {
  const { recomputeHrRisks } = await import("../../src/server/services/hr");
  console.log("open:", await recomputeHrRisks());
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
