import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type FileChange } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

function workflowChange(options: {
  baseContent?: string | null;
  headContent?: string | null;
  status?: FileChange["status"];
}): FileChange {
  return {
    path: ".github/workflows/release.yml",
    status: options.status ?? "modified",
    additions: 1,
    deletions: 0,
    baseContent: options.baseContent,
    headContent: options.headContent,
  };
}

describe("workflow/permission-escalation", () => {
  it("emits for contents read to write", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions:\n  contents: read\n",
            headContent: "permissions:\n  contents: write\n",
          }),
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/permission-escalation",
        severity: "error",
        path: ".github/workflows/release.yml",
        evidence: expect.arrayContaining([
          { label: "changed_file", value: ".github/workflows/release.yml" },
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "write" },
        ]),
      }),
    );
  });

  it("emits for pull-requests none to write", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions: {}\n",
            headContent: "permissions:\n  pull-requests: write\n",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/permission-escalation",
        evidence: expect.arrayContaining([
          { label: "permission", value: "pull-requests" },
          { label: "before", value: "none" },
          { label: "after", value: "write" },
        ]),
      }),
    );
  });

  it("emits for id-token none to write", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions: {}\n",
            headContent: "permissions:\n  id-token: write\n",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/permission-escalation",
        evidence: expect.arrayContaining([
          { label: "permission", value: "id-token" },
          { label: "before", value: "none" },
          { label: "after", value: "write" },
        ]),
      }),
    );
  });

  it("emits for read-all to write-all", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions: read-all\n",
            headContent: "permissions: write-all\n",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/permission-escalation",
        evidence: expect.arrayContaining([
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "write" },
        ]),
      }),
    );
  });

  it("does not emit for write to read", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions:\n  contents: write\n",
            headContent: "permissions:\n  contents: read\n",
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
  });

  it("does not emit for removed workflows", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions:\n  contents: write\n",
            headContent: null,
            status: "removed",
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
  });

  it("does not crash or emit escalation for malformed head workflows", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions: {}\n",
            headContent: "permissions: [",
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
    expect(result.findings.map((finding) => finding.ruleId)).toContain(
      "workflow/dangerous-pattern",
    );
  });
});
