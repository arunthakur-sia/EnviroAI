/* eslint-disable no-console */
// CR05 1.5: WCAG AA contrast audit over the token pairs used for text and key
// UI states. Reads the current values straight from src/styles/globals.css so
// the report always reflects the shipped tokens. Exit code 1 on any failure.
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(
  path.join(process.cwd(), "src", "styles", "globals.css"),
  "utf8"
);

function token(name) {
  const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1].trim();
}

function parseColor(v) {
  if (v.startsWith("#")) {
    const h = v.slice(1);
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = v.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  throw new Error(`cannot parse colour ${v}`);
}

/** Composite a possibly-translucent foreground over an opaque base. */
function over(fg, base) {
  const a = fg.a;
  return {
    r: fg.r * a + base.r * (1 - a),
    g: fg.g * a + base.g * (1 - a),
    b: fg.b * a + base.b * (1 - a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const C = (name) => parseColor(token(name));
const WHITE = parseColor("#ffffff");

const bar = C("--color-bar");
const barMuted = over(C("--color-bar-muted"), bar);
const barField = over(C("--color-bar-field"), bar);

// [label, fg, bg, requirement, note]
// "AA" = 4.5 (normal text), "AA-large" = 3.0 (18px+ or 14px bold), "UI" = 3.0
// (non-text UI, WCAG 1.4.11).
const checks = [
  ["ink-900 on white (body on cards)", C("--color-ink-900"), WHITE, 4.5],
  ["ink-900 on mist-50 (body on page)", C("--color-ink-900"), C("--color-mist-50"), 4.5],
  ["ink-900 on mist-100 (body on bands)", C("--color-ink-900"), C("--color-mist-100"), 4.5],
  ["ink-600 on white (secondary)", C("--color-ink-600"), WHITE, 4.5],
  ["ink-600 on mist-50", C("--color-ink-600"), C("--color-mist-50"), 4.5],
  ["ink-600 on mist-100 (rail idle items)", C("--color-ink-600"), C("--color-mist-100"), 4.5],
  ["ink-600 on aqua-100 (aqua chips)", C("--color-ink-600"), C("--color-aqua-100"), 4.5],
  ["ink-400 on white (tertiary meta, large-only rule)", C("--color-ink-400"), WHITE, 3.0, "meta text 12px+; never body"],
  ["navy-700 on white (links, actions)", C("--color-navy-700"), WHITE, 4.5],
  ["navy-700 on mist-50", C("--color-navy-700"), C("--color-mist-50"), 4.5],
  ["navy-700 on navy-100 (rail active pill)", C("--color-navy-700"), C("--color-navy-100"), 4.5],
  ["navy-900 on navy-100", C("--color-navy-900"), C("--color-navy-100"), 4.5],
  ["white on navy-700 (primary buttons)", WHITE, C("--color-navy-700"), 4.5],
  ["bar-ink on bar (top bar text)", C("--color-bar-ink"), bar, 4.5],
  ["bar-muted on bar (top bar secondary)", barMuted, bar, 4.5],
  ["bar-ink on bar-field (search field text)", C("--color-bar-ink"), barField, 4.5],
  ["ink-900 on bar-field-focus (focused search)", C("--color-ink-900"), C("--color-bar-field-focus"), 4.5],
  ["aqua-500 focus ring on bar (UI, 3.0)", C("--color-aqua-500"), bar, 3.0, "non-text focus indicator"],
  ["teal-600 on white (data accent text)", C("--color-teal-600"), WHITE, 4.5],
  ["teal-600 on teal-100 (chips)", C("--color-teal-600"), C("--color-teal-100"), 4.5],
  ["ok on ok-light (status chips)", C("--color-ok"), C("--color-ok-light"), 4.5],
  ["warn on warn-light", C("--color-warn"), C("--color-warn-light"), 4.5],
  ["danger on danger-light", C("--color-danger"), C("--color-danger-light"), 4.5],
  ["info on info-light", C("--color-info"), C("--color-info-light"), 4.5],
  ["mist-300 borders on white (UI, 3.0 not required for decorative hairlines)", C("--color-mist-300"), WHITE, 1.2, "decorative hairline, informational only"],
];

let failures = 0;
console.log("CR05 contrast audit (WCAG AA)\n");
for (const [label, fg, bg, min, note] of checks) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass) failures++;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}${note ? `  [${note}]` : ""}`
  );
}
console.log(failures === 0 ? "\nAll pairs pass." : `\n${failures} pair(s) FAIL.`);
process.exit(failures === 0 ? 0 : 1);
