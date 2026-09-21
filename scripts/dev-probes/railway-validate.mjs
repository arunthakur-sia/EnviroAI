/* eslint-disable no-console */
// Validates railway.json against the published schema: every key we set must
// exist, and every constrained value must be one the schema allows.
import fs from "node:fs";
import path from "node:path";

const strip = (s) => s.replace(/^﻿/, "");
const schemaFile = process.argv[2];
const schema = JSON.parse(strip(fs.readFileSync(schemaFile, "utf8")));
const config = JSON.parse(strip(fs.readFileSync(path.join(process.cwd(), "railway.json"), "utf8")));

const problems = [];

/** The set of literal values an anyOf/const/enum node allows, or null when free. */
function allowedValues(node) {
  if (!node) return null;
  if (Array.isArray(node.enum)) return new Set(node.enum);
  const out = new Set();
  let sawFree = false;
  const walk = (n) => {
    if (!n) return;
    if (n.const !== undefined) return void out.add(n.const);
    if (Array.isArray(n.enum)) return void n.enum.forEach((v) => out.add(v));
    if (Array.isArray(n.anyOf)) return void n.anyOf.forEach(walk);
    if (n.type === "null") return;
    sawFree = true;
  };
  walk(node);
  return sawFree || !out.size ? null : out;
}

function typeOf(node) {
  const types = new Set();
  const walk = (n) => {
    if (!n) return;
    if (n.type && n.type !== "null") types.add(n.type);
    if (n.const !== undefined) types.add(typeof n.const);
    if (Array.isArray(n.anyOf)) n.anyOf.forEach(walk);
  };
  walk(node);
  return types;
}

for (const [section, body] of Object.entries(config)) {
  if (section === "$schema") continue;
  const sectionSchema = schema.properties?.[section];
  if (!sectionSchema) {
    problems.push(`no such section: ${section}`);
    continue;
  }
  for (const [key, value] of Object.entries(body)) {
    const node = sectionSchema.properties?.[key];
    if (!node) {
      problems.push(`${section}.${key}: not in the schema`);
      continue;
    }
    const allowed = allowedValues(node);
    if (allowed && !allowed.has(value)) {
      problems.push(`${section}.${key}: ${JSON.stringify(value)} is not one of ${[...allowed].join(", ")}`);
      continue;
    }
    const types = typeOf(node);
    const actual = typeof value;
    const ok =
      !types.size ||
      types.has(actual) ||
      (actual === "number" && (types.has("integer") || types.has("number")));
    if (!ok) problems.push(`${section}.${key}: expected ${[...types].join("/")}, got ${actual}`);
    else console.log(`ok  ${section}.${key} = ${JSON.stringify(value)}`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\nrailway.json matches the schema");
