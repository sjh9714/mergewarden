import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type FileChange } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

const PINNED_SHA = "0123456789abcdef0123456789abcdef01234567";

function workflowChange(options: {
  headContent: string;
  baseContent?: string | null;
  patch?: string;
}): FileChange {
  return {
    path: ".github/workflows/release.yml",
    status: "modified",
    additions: 1,
    deletions: 0,
    baseContent: options.baseContent ?? "permissions: {}\n",
    headContent: options.headContent,
    patch: options.patch,
  };
}

describe("workflow/dangerous-pattern", () => {
  it("emits for permissions write-all", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [workflowChange({ headContent: "permissions: write-all\n" })],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "error",
        path: ".github/workflows/release.yml",
        evidence: expect.arrayContaining([{ label: "pattern", value: "permissions: write-all" }]),
      }),
    );
  });

  it("emits for id-token write", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [workflowChange({ headContent: "permissions:\n  id-token: write\n" })],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "error",
        evidence: expect.arrayContaining([{ label: "pattern", value: "id-token: write" }]),
      }),
    );
  });

  it("emits for pull_request_target workflows that check out PR head", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent:
              "'on':\n  pull_request_target:\npermissions: {}\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "error",
        evidence: expect.arrayContaining([
          { label: "pattern", value: "pull_request_target checkout of PR head" },
        ]),
      }),
    );
  });

  it("emits for unpinned third-party actions when configured to warn", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\ngithub_actions:\n  require_pinned_actions: warn\n",
        ),
        files: [
          workflowChange({
            headContent:
              "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: third-party/action@v1\n",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "warn",
        evidence: expect.arrayContaining([
          { label: "pattern", value: "unpinned third-party action" },
          { label: "action", value: "third-party/action@v1" },
        ]),
      }),
    );
  });

  it("does not emit for third-party actions pinned to a SHA", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\ngithub_actions:\n  require_pinned_actions: warn\n",
        ),
        files: [
          workflowChange({
            headContent: `permissions: {}\njobs:\n  test:\n    steps:\n      - uses: third-party/action@${PINNED_SHA}\n`,
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/dangerous-pattern",
    );
  });

  it("allows actions/checkout@v4 without SHA pinning in v0.1", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(
          "version: 1\nmode: block\ngithub_actions:\n  require_pinned_actions: warn\n",
        ),
        files: [
          workflowChange({
            headContent:
              "permissions: {}\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/dangerous-pattern",
    );
  });

  it("emits a warning for added secrets references in patches", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: "permissions: {}\n",
            patch: "+      TOKEN: ${{ secrets.MY_SECRET }}\n",
          }),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "warn",
        evidence: expect.arrayContaining([{ label: "pattern", value: "added secrets reference" }]),
      }),
    );
  });

  it("emits for malformed head workflow YAML", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [workflowChange({ headContent: "permissions: [" })],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "error",
        evidence: expect.arrayContaining([expect.objectContaining({ label: "parse_error" })]),
      }),
    );
  });
});
