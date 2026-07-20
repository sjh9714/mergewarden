import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  analyze,
  parseConfig,
  renderMarkdownReport,
  type AnalysisResult,
  type FileChange,
} from "../src/index.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

const PINNED_SHA = "0123456789abcdef0123456789abcdef01234567";

function workflowChange(options: Partial<FileChange> = {}): FileChange {
  return {
    path: ".github/workflows/policy.yml",
    status: "modified",
    additions: 1,
    deletions: 0,
    baseContent: "permissions: {}\njobs: {}\n",
    headContent: "permissions: {}\njobs: {}\n",
    ...options,
  };
}

function findingSection(result: AnalysisResult, ruleId: string): string {
  const report = renderMarkdownReport(result);
  const marker = new RegExp(
    `^### (?:INFO|WARN|ERROR) ${ruleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    "m",
  );
  const match = marker.exec(report);

  if (!match?.index) {
    throw new Error(`Expected Markdown report section for ${ruleId}`);
  }

  const remaining = report.slice(match.index);
  const nextHeader = /\n(?:### |## )/.exec(remaining.slice(1));
  const end = nextHeader?.index === undefined ? remaining.length : nextHeader.index + 1;
  return `${remaining.slice(0, end).trim()}\n`;
}

function expectRuleSnapshot(result: AnalysisResult, ruleId: string, fileName: string): void {
  const actual = findingSection(result, ruleId);
  const snapshotUrl = new URL(`./snapshots/${fileName}`, import.meta.url);
  expect(actual).toBe(readFileSync(fileURLToPath(snapshotUrl), "utf8"));
}

describe("user-facing Markdown rule snapshots", () => {
  it("snapshots analysis/file-list-incomplete", async () => {
    const input = createAnalysisInput();
    input.analysis = {
      complete: false,
      expectedFileCount: 42,
      analyzedFileCount: 41,
      contentFileCount: 0,
      runtimeRef: "mergewarden@v0.3.0",
      gaps: [
        {
          ruleId: "analysis/file-list-incomplete",
          message: "Expected 42 files but collected 41.",
          evidence: [
            { label: "expected_files", value: "42" },
            { label: "collected_files", value: "41" },
          ],
        },
      ],
    };

    expectRuleSnapshot(
      await analyze(input),
      "analysis/file-list-incomplete",
      "analysis-file-list-incomplete.md",
    );
  });

  it("snapshots analysis/content-unavailable", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [workflowChange({ headContent: null })],
      }),
    );

    expectRuleSnapshot(result, "analysis/content-unavailable", "analysis-content-unavailable.md");
  });

  it("snapshots analysis/finding-limit-exceeded", async () => {
    const files = Array.from({ length: 251 }, (_, index) => fileChange(`src/outside-${index}.ts`));
    const fullResult = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        contract: {
          kind: "valid",
          contract: { version: 1, allowed_paths: ["allowed/**"] },
        },
        files,
      }),
    );
    const capFinding = fullResult.findings.find(
      (finding) => finding.ruleId === "analysis/finding-limit-exceeded",
    );
    if (!capFinding) {
      throw new Error("Expected finding-limit finding");
    }
    const result = { ...fullResult, findings: [capFinding] };

    expectRuleSnapshot(
      result,
      "analysis/finding-limit-exceeded",
      "analysis-finding-limit-exceeded.md",
    );
  });

  it("snapshots workflow/dangerous-pattern", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [workflowChange({ status: "removed", baseContent: null, headContent: null })],
      }),
    );

    expectRuleSnapshot(result, "workflow/dangerous-pattern", "workflow-dangerous-pattern.md");
  });

  it("snapshots workflow/permission-escalation", async () => {
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

    expectRuleSnapshot(
      result,
      "workflow/permission-escalation",
      "workflow-permission-escalation.md",
    );
  });

  it("snapshots workflow/base-invalid", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          workflowChange({
            baseContent: "permissions: [",
            headContent: "permissions: {}\njobs: {}\n",
          }),
        ],
      }),
    );

    expectRuleSnapshot(result, "workflow/base-invalid", "workflow-base-invalid.md");
  });

  it("snapshots workflow/agentic-untrusted-input", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: `
permissions: read-all
jobs:
  review:
    steps:
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: \${{ github.event.pull_request.body }}
`,
          }),
        ],
      }),
    );

    expectRuleSnapshot(
      result,
      "workflow/agentic-untrusted-input",
      "workflow-agentic-untrusted-input.md",
    );
  });

  it("snapshots policy/waiver-expired", async () => {
    const initial = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );
    const findingId = initial.findings[0]?.findingId;
    if (!findingId) {
      throw new Error("Expected control-plane finding");
    }
    const input = createAnalysisInput({
      config: parseConfig(`
version: 1
mode: block
waivers:
  - finding_id: ${findingId}
    reason: Approved temporary exception
    expires_at: 2026-06-12T00:00:00Z
`),
      files: [fileChange("AGENTS.md")],
    });
    input.configSource = "base-branch";

    expectRuleSnapshot(await analyze(input), "policy/waiver-expired", "policy-waiver-expired.md");
  });

  it("snapshots policy/waiver-forbidden", async () => {
    const initialInput = createAnalysisInput();
    initialInput.analysis = {
      complete: false,
      expectedFileCount: 2,
      analyzedFileCount: 1,
      contentFileCount: 0,
      runtimeRef: "mergewarden@v0.3.0",
      gaps: [
        {
          ruleId: "analysis/file-list-incomplete",
          message: "Expected 2 files but collected 1.",
          evidence: [
            { label: "expected_files", value: "2" },
            { label: "collected_files", value: "1" },
          ],
        },
      ],
    };
    const initial = await analyze(initialInput);
    const findingId = initial.findings[0]?.findingId;
    if (!findingId) {
      throw new Error("Expected analysis-integrity finding");
    }
    const input = {
      ...initialInput,
      config: parseConfig(`
version: 1
waivers:
  - finding_id: ${findingId}
    reason: Must not apply
    expires_at: 2026-09-30T00:00:00Z
`),
      configSource: "base-branch" as const,
    };

    expectRuleSnapshot(
      await analyze(input),
      "policy/waiver-forbidden",
      "policy-waiver-forbidden.md",
    );
  });
});
