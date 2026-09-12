// One-off connectivity check for Anthropic and Voyage from behind the corporate proxy.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

async function probe(name, url, opts) {
  try {
    const res = await fetch(url, opts);
    const body = await res.text();
    console.log(`${name}: HTTP ${res.status} ${body.slice(0, 160).replace(/\s+/g, " ")}`);
  } catch (e) {
    console.log(`${name}: FAIL ${e?.cause?.code || e?.message || e}`);
  }
}

await probe("anthropic", "https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": env.ANTHROPIC_API_KEY || "",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5",
    max_tokens: 16,
    messages: [{ role: "user", content: "Say ok" }],
  }),
});

await probe("voyage", "https://api.voyageai.com/v1/embeddings", {
  method: "POST",
  headers: {
    authorization: `Bearer ${env.VOYAGE_API_KEY || ""}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ input: ["hello world"], model: "voyage-multilingual-2" }),
});
