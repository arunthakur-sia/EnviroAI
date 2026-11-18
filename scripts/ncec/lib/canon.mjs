// Canonical string forms, so rows read back from SQLite and Postgres compare equal.
export const stable = (v) =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? `[${v.map(stable).join(",")}]`
      : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;

export function canon(v, type) {
  if (v === null || v === undefined) return null;
  if (type === "int") return String(Number(v));
  if (type === "bool") return v === true || v === 1 || v === "1" || v === "true" ? "1" : "0";
  if (type === "json") return stable(typeof v === "string" ? JSON.parse(v) : v);
  return String(v);
}
