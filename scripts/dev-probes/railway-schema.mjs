// What does the Railway config schema actually call the fields we intend to set?
import fs from "node:fs";
const file = process.argv[2];
const s = JSON.parse(fs.readFileSync(file, "utf8"));
const defs = s.definitions || s["$defs"] || {};
console.log("definitions:", Object.keys(defs).join(", ") || "(none)");
const show = (label, node) => {
  if (!node) return console.log(`${label}: absent`);
  const target = node["$ref"] ? defs[node["$ref"].split("/").pop()] : node;
  console.log(`\n${label}: ${Object.keys(target.properties || {}).join(", ")}`);
  for (const [k, v] of Object.entries(target.properties || {})) {
    const t = v.type || (v["$ref"] ? v["$ref"].split("/").pop() : v.enum ? "enum" : "?");
    const en = v.enum ? ` [${v.enum.join(" | ")}]` : "";
    console.log(`   ${k.padEnd(28)} ${JSON.stringify(t)}${en}`);
  }
};
show("build", s.properties.build);
show("deploy", s.properties.deploy);
