import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseTriageOptions, TriageUsageError } from "../src/triage.js";

describe("parseTriageOptions", () => {
  it("accepts owner/repository with defaults", () => {
    expect(parseTriageOptions(["vercel/next.js"])).toEqual({
      owner: "vercel",
      repo: "next.js",
      limit: 20,
      format: "human",
    });
  });

  it("does not read an option value as the repository argument", () => {
    // The first parser did, so `triage owner/repo --limit 12` failed as two positionals.
    expect(parseTriageOptions(["vercel/next.js", "--limit", "12"])).toMatchObject({
      owner: "vercel",
      repo: "next.js",
      limit: 12,
    });
    expect(parseTriageOptions(["--limit", "5", "vercel/next.js"])).toMatchObject({ limit: 5 });
  });

  it("accepts both output formats", () => {
    expect(parseTriageOptions(["a/b", "--format", "json"])).toMatchObject({ format: "json" });
    expect(parseTriageOptions(["a/b", "--format", "human"])).toMatchObject({ format: "human" });
  });

  it("rejects input it cannot act on", () => {
    expect(() => parseTriageOptions([])).toThrow(TriageUsageError);
    expect(() => parseTriageOptions(["a/b", "c/d"])).toThrow(TriageUsageError);
    expect(() => parseTriageOptions(["not-a-repo"])).toThrow(/Expected owner\/repository/);
    expect(() => parseTriageOptions(["a/b", "--limit", "0"])).toThrow(/--limit/);
    expect(() => parseTriageOptions(["a/b", "--limit", "500"])).toThrow(/--limit/);
    expect(() => parseTriageOptions(["a/b", "--format", "yaml"])).toThrow(/--format/);
    expect(() => parseTriageOptions(["a/b", "--close"])).toThrow(/Unknown triage option/);
  });

  it("has no option that acts on a pull request", () => {
    // Deliberate: the competing tools that auto-close are the ones whose issue trackers fill
    // with false positives that cannot be undone. There is nothing here to close, label, or
    // comment with, and that is the design.
    for (const flag of ["--close", "--label", "--comment", "--fix"]) {
      expect(() => parseTriageOptions(["a/b", flag])).toThrow(/Unknown triage option/);
    }
  });
});

describe("triage output formats", () => {
  it("keeps the human and JSON views in agreement", () => {
    // They diverged once: the uniform-note partition ran after the JSON branch returned, so a
    // validation run that asked for JSON measured the behaviour the fix had already removed.
    const source = readFileSync(new URL("../src/triage.ts", import.meta.url), "utf8");
    const partitionAt = source.indexOf("const partitioned = partitionUniformNotes(rows)");
    const jsonBranchAt = source.indexOf('if (options.format === "json")');

    expect(partitionAt).toBeGreaterThan(-1);
    expect(jsonBranchAt).toBeGreaterThan(-1);
    expect(partitionAt).toBeLessThan(jsonBranchAt);
  });
});

describe("triage automation reporting", () => {
  it("distinguishes an automation queue from an empty result in the source", () => {
    // A queue of ten dependabot bumps printed as "10 read, 0 flagged", which reads as the tool
    // failing rather than as there being nothing here for a human. 14 of the 14 silent
    // repositories in the validation run were exactly this.
    const source = readFileSync(new URL("../src/triage.ts", import.meta.url), "utf8");

    expect(source).toContain("are maintenance automation and were not read");
    expect(source).toContain("Nothing here is waiting on a human");
    // Excluded authors come from the analysed policy, not a second copy of the list.
    expect(source).toContain("input.config.triage.exclude_authors");
  });
});
