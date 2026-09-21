/**
 * The data directory rule is written twice: once in TypeScript for the app
 * (src/server/paths.ts) and once in plain JavaScript for the boot script and
 * the other scripts that run without a TypeScript loader
 * (scripts/lib/paths.mjs). These tests fail if the two ever disagree, and
 * pin the behaviour the stored `data/...` paths in the database depend on.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import * as ts from "@/server/paths";
import * as js from "../scripts/lib/paths.mjs";

describe("the data directory", () => {
  it("is the same in both implementations", () => {
    expect(ts.DATA_DIR).toBe(js.DATA_DIR);
  });

  it("defaults to ./data when DATA_DIR is not set", () => {
    // the suite runs without DATA_DIR set, which is the local default
    expect(ts.DATA_DIR).toBe(path.resolve(process.cwd(), "data"));
  });

  it("puts every named folder inside it", () => {
    for (const dir of [ts.UPLOADS_DIR, ts.REPORTS_DIR, ts.PODCASTS_DIR, ts.IMPORT_DIR, ts.TMP_DIR]) {
      expect(ts.isInsideDataDir(dir)).toBe(true);
    }
    expect(ts.DB_PATH).toBe(path.join(ts.DATA_DIR, "nexus.db"));
  });
});

describe("paths stored in the database", () => {
  const cases = [
    "data/uploads/01ABC/report.pdf",
    "uploads/01ABC/report.pdf",
    "data/reports/module/01XYZ-en.docx",
    "reports/module/01XYZ-en.docx",
    "podcasts/01EP.mp3",
  ];

  it("resolve identically in both implementations", () => {
    for (const stored of cases) {
      expect(ts.resolveDataPath(stored)).toBe(js.resolveDataPath(stored));
    }
  });

  it("resolve inside the data directory, with or without the data/ prefix", () => {
    for (const stored of cases) {
      const resolved = ts.resolveDataPath(stored);
      expect(ts.isInsideDataDir(resolved)).toBe(true);
    }
    // the two spellings of the same file are the same file
    expect(ts.resolveDataPath("data/uploads/a/b.pdf")).toBe(ts.resolveDataPath("uploads/a/b.pdf"));
  });

  it("round-trip: an absolute path inside the data directory stores and resolves back", () => {
    const abs = ts.dataPath("uploads", "01ABC", "report.pdf");
    const stored = ts.storedDataPath(abs);
    expect(stored).toBe("data/uploads/01ABC/report.pdf");
    expect(ts.resolveDataPath(stored)).toBe(abs);
    expect(js.storedDataPath(abs)).toBe(stored);
  });

  it("leaves an absolute stored path alone", () => {
    const abs = path.resolve(ts.DATA_DIR, "uploads", "x.pdf");
    expect(ts.resolveDataPath(abs)).toBe(abs);
  });

  it("refuses a path that climbs out of the data directory", () => {
    const escaped = ts.resolveDataPath("../../etc/passwd");
    expect(ts.isInsideDataDir(escaped)).toBe(false);
  });
});
