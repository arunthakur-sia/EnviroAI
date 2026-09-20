/* eslint-disable no-console */
// Is the live model reachable right now? Prints presence booleans and the
// status of one tiny call. Never prints any key material.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  console.log(`ANTHROPIC_API_KEY present: ${Boolean(key)}`);
  console.log(`VOYAGE_API_KEY present: ${Boolean(process.env.VOYAGE_API_KEY)}`);
  console.log(`ELEVENLABS_API_KEY present: ${Boolean(process.env.ELEVENLABS_API_KEY)}`);
  if (!key) return;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
    }),
  });
  const body = (await res.text()).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
  console.log(`live call status: ${res.status}`);
  console.log(`body: ${body.slice(0, 300)}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(String((e as Error)?.message ?? e).slice(0, 200));
    process.exit(1);
  });
