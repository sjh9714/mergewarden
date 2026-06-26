import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type FileChange } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

function packageJsonChange(options: {
  path?: string;
  status?: FileChange["status"];
  baseContent?: string | null;
  headContent?: string | null;
}): FileChange {
  return {
    path: options.path ?? "package.json",
    status: options.status ?? "modified",
    additions: 1,
    deletions: 1,
    baseContent: options.baseContent,
    headContent: options.headContent,
  };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

describe("package lifecycle script drift", () => {
  it("emits when a lifecycle script is added", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: json({ scripts: { test: "vitest" } }),
            headContent: json({ scripts: { test: "vitest", preinstall: "node setup.js" } }),
          }),
        ],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "dependency/lifecycle-script-added",
        severity: "warn",
        path: "package.json",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "package.json" },
          { label: "script", value: "preinstall" },
          { label: "change", value: "added" },
          { label: "after", value: "node setup.js" },
        ]),
      }),
    );
  });

  it("emits when a lifecycle script changes", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: json({ scripts: { postinstall: "node old.js" } }),
            headContent: json({ scripts: { postinstall: "node new.js" } }),
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "dependency/package-script-drift",
        severity: "warn",
        path: "package.json",
        evidence: expect.arrayContaining([
          { label: "script", value: "postinstall" },
          { label: "change", value: "changed" },
          { label: "before", value: "node old.js" },
          { label: "after", value: "node new.js" },
        ]),
      }),
    );
  });

  it("ignores non-lifecycle script changes and dependency-only changes", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: json({ scripts: { test: "vitest" }, dependencies: { leftpad: "1.0.0" } }),
            headContent: json({
              scripts: { test: "vitest --run" },
              dependencies: { leftpad: "1.0.1" },
            }),
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "dependency/lifecycle-script-added",
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "dependency/package-script-drift",
    );
  });

  it("emits for nested package manifests by default", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            path: "packages/api/package.json",
            baseContent: json({ scripts: {} }),
            headContent: json({ scripts: { prepare: "node prepare.js" } }),
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "dependency/lifecycle-script-added",
        path: "packages/api/package.json",
        evidence: expect.arrayContaining([{ label: "script", value: "prepare" }]),
      }),
    );
  });

  it("can be disabled with package_scripts.enabled", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\npackage_scripts:\n  enabled: false\n"),
        files: [
          packageJsonChange({
            baseContent: json({ scripts: {} }),
            headContent: json({ scripts: { install: "node install.js" } }),
          }),
        ],
      }),
    );

    expect(result.findings).toEqual([]);
  });

  it("emits parse evidence for malformed package JSON", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: json({ scripts: {} }),
            headContent: "{",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "dependency/package-script-drift",
        severity: "warn",
        path: "package.json",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "package.json" },
          { label: "change", value: "parse-error" },
          expect.objectContaining({ label: "parse_error" }),
        ]),
      }),
    );
  });

  it("does not emit lifecycle script findings when modified base content is unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: null,
            headContent: json({ scripts: { preinstall: "node setup.js" } }),
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "dependency/lifecycle-script-added",
    );
    expect(result.findings.map((finding) => finding.ruleId)).toContain(
      "analysis/content-unavailable",
    );
  });

  it("does not emit lifecycle script findings when modified head content is unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: json({ scripts: { postinstall: "node old.js" } }),
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "dependency/package-script-drift",
    );
    expect(result.findings.map((finding) => finding.ruleId)).toContain(
      "analysis/content-unavailable",
    );
  });

  it("still detects added package manifests with lifecycle scripts", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            status: "added",
            baseContent: null,
            headContent: json({ scripts: { preinstall: "node setup.js" } }),
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "dependency/lifecycle-script-added",
        path: "package.json",
        evidence: expect.arrayContaining([{ label: "script", value: "preinstall" }]),
      }),
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "analysis/content-unavailable",
    );
  });

  it("emits parse evidence for malformed base package JSON", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            baseContent: "{",
            headContent: json({ scripts: { install: "node install.js" } }),
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "dependency/package-script-drift",
        severity: "warn",
        path: "package.json",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "package.json" },
          { label: "change", value: "parse-error" },
          expect.objectContaining({ label: "parse_error" }),
        ]),
      }),
    );
  });

  it("ignores removed package manifests", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          packageJsonChange({
            status: "removed",
            baseContent: json({ scripts: { preinstall: "node setup.js" } }),
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.findings).toEqual([]);
  });
});
