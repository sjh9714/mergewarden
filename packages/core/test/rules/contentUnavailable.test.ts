import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type FileChange } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

function fileChange(options: Partial<FileChange> = {}): FileChange {
  return {
    path: ".github/workflows/release.yml",
    status: "modified",
    additions: 1,
    deletions: 0,
    baseContent: "permissions:\n  contents: read\n",
    headContent: "permissions:\n  contents: write\n",
    ...options,
  };
}

describe("analysis/content-unavailable", () => {
  it("emits when workflow head content is unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange({ headContent: null })],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "analysis/content-unavailable",
        severity: "error",
        path: ".github/workflows/release.yml",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: ".github/workflows/release.yml" },
          { label: "content_ref", value: "head" },
          { label: "file_status", value: "modified" },
        ]),
      }),
    );
  });

  it("emits when modified workflow base content is unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange({ baseContent: null })],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "analysis/content-unavailable",
        evidence: expect.arrayContaining([{ label: "content_ref", value: "base" }]),
      }),
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
  });

  it("does not emit for expected null content on added or removed workflows", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          fileChange({
            status: "added",
            baseContent: null,
            headContent: "permissions:\n  contents: read\n",
          }),
          fileChange({
            status: "removed",
            baseContent: "permissions:\n  contents: read\n",
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "analysis/content-unavailable",
    );
  });

  it("does not emit for non-workflow files with unavailable content", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          fileChange({
            path: "src/app.ts",
            baseContent: null,
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "analysis/content-unavailable",
    );
  });

  it("emits when package manifest head content is unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          fileChange({
            path: "package.json",
            baseContent: '{ "scripts": {} }\n',
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "analysis/content-unavailable",
        severity: "warn",
        path: "package.json",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: "package.json" },
          { label: "content_ref", value: "head" },
          { label: "file_status", value: "modified" },
        ]),
      }),
    );
  });

  it("emits when package manifest base content is unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          fileChange({
            path: "package.json",
            baseContent: null,
            headContent: '{ "scripts": { "preinstall": "node setup.js" } }\n',
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "analysis/content-unavailable",
        severity: "warn",
        path: "package.json",
        evidence: expect.arrayContaining([{ label: "content_ref", value: "base" }]),
      }),
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "dependency/lifecycle-script-added",
    );
  });

  it("does not emit for package manifests when package script checks are disabled", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\npackage_scripts:\n  enabled: false\n"),
        files: [
          fileChange({
            path: "package.json",
            baseContent: null,
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "analysis/content-unavailable",
    );
  });
});
