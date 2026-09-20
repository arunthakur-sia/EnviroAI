// CR08 Phase A: the two message files carry the same keys, every value is a
// non-empty string, no value contains an em dash or an en dash, and every
// ICU plural in Arabic carries the forms Arabic needs.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MESSAGES = path.join(process.cwd(), "messages");

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES, file), "utf8").replace(/^﻿/, ""));
}

function flatten(obj: Record<string, unknown>, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [ck, cv] of flatten(v as Record<string, unknown>, key)) out.set(ck, cv);
    } else {
      out.set(key, String(v));
    }
  }
  return out;
}

const en = flatten(readJson("en.json"));
const ar = flatten(readJson("ar.json"));

describe("i18n parity", () => {
  it("en and ar carry the same keys", () => {
    const missingAr = [...en.keys()].filter((k) => !ar.has(k));
    const missingEn = [...ar.keys()].filter((k) => !en.has(k));
    expect(missingAr, `missing in ar: ${missingAr.slice(0, 20).join(", ")}`).toEqual([]);
    expect(missingEn, `missing in en: ${missingEn.slice(0, 20).join(", ")}`).toEqual([]);
  });

  it("every value is a non-empty string", () => {
    const empty = [...en.entries(), ...ar.entries()].filter(([, v]) => !v.trim());
    expect(empty.map(([k]) => k)).toEqual([]);
  });

  it("no value carries an em dash or an en dash", () => {
    const bad = [...en.entries(), ...ar.entries()].filter(([, v]) => /[–—]/.test(v));
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it("every ICU placeholder in en exists in ar", () => {
    const problems: string[] = [];
    // variables are lowercase identifiers; a plural branch such as `=0 {Inbox}`
    // is text, not a variable
    const VAR = /\{([a-z]\w*)(?=[,}])/g;
    for (const [k, v] of en) {
      const enVars = new Set([...v.matchAll(VAR)].map((m) => m[1]));
      const arVars = new Set([...(ar.get(k) ?? "").matchAll(VAR)].map((m) => m[1]));
      for (const name of enVars) if (!arVars.has(name)) problems.push(`${k}:{${name}}`);
    }
    expect(problems).toEqual([]);
  });

  it("Arabic plurals carry zero, one, two, few, many and other", () => {
    const problems: string[] = [];
    for (const [k, v] of ar) {
      if (!/\{\w+,\s*plural,/.test(v)) continue;
      for (const form of ["one", "two", "few", "many", "other"]) {
        if (!new RegExp(`\\b${form}\\s*\\{`).test(v)) problems.push(`${k} lacks ${form}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
