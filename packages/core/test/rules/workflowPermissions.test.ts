import { describe, expect, it } from "vitest";

import {
  analyze,
  parseConfig,
  renderJsonReport,
  renderMarkdownReport,
  type FileChange,
} from "../../src/index.js";
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
          { label: "permission_scope", value: "workflow" },
          { label: "affected_capability", value: "repository_content_writes" },
        ]),
      }),
    );
    expect(result.findings[0]?.message).toBe(
      "contents permission increased from read to write at workflow scope; this can affect release, tag, and repository content writes. Confirm whether this permission boundary change is expected.",
    );
  });

  it("emits job scope and job name for job-level permission escalation", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent:
              "permissions:\n  contents: read\njobs:\n  release:\n    steps:\n      - run: echo release\n",
            headContent:
              "permissions:\n  contents: read\njobs:\n  release:\n    permissions:\n      contents: write\n    steps:\n      - run: echo release\n",
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
          { label: "permission_scope", value: "job" },
          { label: "job", value: "release" },
          { label: "affected_capability", value: "repository_content_writes" },
        ]),
      }),
    );
    expect(result.findings[0]?.message).toBe(
      "contents permission increased from read to write at job 'release' scope; this can affect release, tag, and repository content writes. Confirm whether this permission boundary change is expected.",
    );
  });

  it("emits when removing restrictive job permissions exposes broader workflow permissions", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent:
              "permissions:\n  contents: write\njobs:\n  release:\n    permissions:\n      contents: read\n    steps:\n      - run: echo release\n",
            headContent:
              "permissions:\n  contents: write\njobs:\n  release:\n    steps:\n      - run: echo release\n",
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
          { label: "permission_scope", value: "job" },
          { label: "job", value: "release" },
          { label: "affected_capability", value: "repository_content_writes" },
        ]),
      }),
    );
    expect(result.findings[0]?.message).toBe(
      "contents permission increased from read to write at job 'release' scope; this can affect release, tag, and repository content writes. Confirm whether this permission boundary change is expected.",
    );
  });

  it("surfaces richer permission context across JSON and Markdown reports", async () => {
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
    const parsed = JSON.parse(renderJsonReport(result));
    const markdown = renderMarkdownReport(result);

    expect(parsed.findings[0].evidenceSnapshot.evidence).toEqual(
      expect.arrayContaining([
        { label: "permission_scope", value: "workflow" },
        { label: "affected_capability", value: "repository_content_writes" },
      ]),
    );
    expect(markdown).toContain("- evidence.permission_scope: workflow");
    expect(markdown).toContain("- evidence.affected_capability: repository_content_writes");
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

  it("does not emit for unchanged job-level permissions", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent:
              "jobs:\n  release:\n    permissions:\n      contents: write\n    steps:\n      - run: echo release\n",
            headContent:
              "jobs:\n  release:\n    permissions:\n      contents: write\n    steps:\n      - run: echo release\n",
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
  });

  it("does not treat omitted base permissions as none for modified workflows", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "jobs:\n  test:\n    steps:\n      - run: echo test\n",
            headContent:
              "permissions:\n  contents: read\njobs:\n  test:\n    steps:\n      - run: echo test\n",
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
