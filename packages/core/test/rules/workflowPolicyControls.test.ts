import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type FileChange } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

const PINNED_SHA = "0123456789abcdef0123456789abcdef01234567";
const IMAGE_DIGEST = "a".repeat(64);

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

describe("granular workflow policy controls", () => {
  it("reports workflow deletion without requiring removed content", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(`
version: 1
mode: block
github_actions:
  checks:
    workflow_deleted: error
`),
        files: [
          workflowChange({
            status: "removed",
            baseContent: null,
            headContent: null,
          }),
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "error",
        evidence: expect.arrayContaining([{ label: "pattern", value: "workflow deleted" }]),
      }),
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "analysis/content-unavailable",
    );
  });

  it("treats a workflow renamed out as deletion and renamed in as an added workflow", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            path: "docs/old-ci.yml",
            previousPath: ".github/workflows/old-ci.yml",
            status: "renamed",
            baseContent: null,
            headContent: "documentation: true\n",
          }),
          workflowChange({
            path: ".github/workflows/new-ci.yml",
            previousPath: "docs/new-ci.yml",
            status: "renamed",
            baseContent: null,
            headContent: "jobs:\n  test:\n    steps:\n      - run: echo test\n",
          }),
        ],
      }),
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "workflow/dangerous-pattern",
          severity: "warn",
          path: ".github/workflows/old-ci.yml",
          evidence: expect.arrayContaining([{ label: "pattern", value: "workflow deleted" }]),
        }),
        expect.objectContaining({
          ruleId: "workflow/dangerous-pattern",
          severity: "warn",
          path: ".github/workflows/new-ci.yml",
          evidence: expect.arrayContaining([
            { label: "pattern", value: "top-level permissions missing" },
          ]),
        }),
      ]),
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "analysis/content-unavailable",
    );
  });

  it("reports empty and malformed head workflows with exact configured severity", async () => {
    for (const headContent of ["", "permissions: ["]) {
      const result = await analyze(
        createAnalysisInput({
          config: parseConfig("version: 1\nmode: block\n"),
          files: [workflowChange({ headContent })],
        }),
      );

      expect(result.decision).toBe("block");
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          ruleId: "workflow/dangerous-pattern",
          severity: "error",
          evidence: expect.arrayContaining([
            { label: "pattern", value: "malformed workflow YAML" },
          ]),
        }),
      );
    }
  });

  it("warns when an added workflow omits top-level permissions", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            status: "added",
            baseContent: null,
            headContent: "jobs:\n  test:\n    steps:\n      - run: echo test\n",
          }),
        ],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "warn",
        evidence: expect.arrayContaining([
          { label: "pattern", value: "top-level permissions missing" },
        ]),
      }),
    );
  });

  it("reports newly introduced unknown write permission keys", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: "permissions:\n  future-scope: write\njobs: {}\n",
          }),
        ],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/dangerous-pattern",
        severity: "warn",
        evidence: expect.arrayContaining([
          { label: "pattern", value: "unknown write permission" },
          { label: "permission", value: "future-scope" },
          { label: "permission_scope", value: "workflow" },
        ]),
      }),
    );
  });

  it("checks reusable workflows and all container surfaces", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: `
permissions: {}
jobs:
  call:
    uses: owner/repository/.github/workflows/reusable.yml@v1
  build:
    container: node:22
    services:
      database:
        image: postgres:17
    steps:
      - uses: docker://alpine:3.21
`,
          }),
        ],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "workflow/dangerous-pattern",
          severity: "warn",
          evidence: expect.arrayContaining([
            { label: "pattern", value: "unpinned reusable workflow" },
          ]),
        }),
        expect.objectContaining({
          ruleId: "workflow/dangerous-pattern",
          severity: "warn",
          evidence: expect.arrayContaining([{ label: "pattern", value: "unpinned container" }]),
        }),
      ]),
    );
  });

  it("accepts SHA-pinned reusable workflows and digest-pinned containers", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: `
permissions: {}
jobs:
  call:
    uses: owner/repository/.github/workflows/reusable.yml@${PINNED_SHA}
  build:
    container: node@sha256:${IMAGE_DIGEST}
    services:
      database:
        image: postgres@sha256:${IMAGE_DIGEST}
    steps:
      - uses: docker://alpine@sha256:${IMAGE_DIGEST}
`,
          }),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/dangerous-pattern",
    );
  });

  it("detects explicit git fetch or checkout of PR head under pull_request_target", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: `
'on': pull_request_target
permissions: {}
jobs:
  test:
    steps:
      - run: git fetch origin \${{ github.event.pull_request.head.sha }}
`,
          }),
        ],
      }),
    );

    expect(result.decision).toBe("block");
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

  it("canonicalizes checkout casing and bracket-style PR-head expressions", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: `
'on': pull_request_target
permissions: {}
jobs:
  test:
    steps:
      - uses: Actions/Checkout@${PINNED_SHA}
        with:
          ref: \${{ github['event']['pull_request']['head']['sha'] }}
`,
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
          expect.objectContaining({ label: "head_reference" }),
        ]),
      }),
    );
  });

  it("emits one exact-waiver identity per introduced PR-head reference", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            headContent: `
'on': pull_request_target
permissions: {}
jobs:
  test:
    steps:
      - run: |
          git fetch origin \${{ github.event.pull_request.head.sha }}
          git checkout \${{ github.event.pull_request.head.ref }}
`,
          }),
        ],
      }),
    );
    const findings = result.findings.filter((finding) =>
      finding.evidence.some(
        (evidence) =>
          evidence.label === "pattern" &&
          evidence.value === "pull_request_target checkout of PR head",
      ),
    );

    expect(findings).toHaveLength(2);
    expect(new Set(findings.map((finding) => finding.findingId))).toHaveLength(2);
    expect(
      new Set(
        findings.flatMap((finding) =>
          finding.evidence
            .filter((evidence) => evidence.label === "head_reference")
            .map((evidence) => evidence.value),
        ),
      ),
    ).toHaveLength(2);
  });

  it("does not re-report unchanged dangerous patterns or secret references", async () => {
    const unchanged = `
permissions: write-all
jobs:
  release:
    steps:
      - uses: actions/checkout@v4
        env:
          TOKEN: \${{ secrets.RELEASE_TOKEN }}
`;
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [workflowChange({ baseContent: unchanged, headContent: unchanged })],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/dangerous-pattern",
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
  });

  it("reports invalid base comparison but still performs deterministic head checks", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange({
            baseContent: "permissions: [",
            headContent: "permissions: write-all\njobs: {}\n",
          }),
        ],
      }),
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "workflow/base-invalid", severity: "warn" }),
        expect.objectContaining({
          ruleId: "workflow/dangerous-pattern",
          severity: "error",
          evidence: expect.arrayContaining([{ label: "pattern", value: "permissions: write-all" }]),
        }),
      ]),
    );
  });

  it("honors granular off settings without legacy precedence", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(`
version: 1
mode: block
github_actions:
  checks:
    write_all: off
    id_token_write: off
    permission_escalation: off
`),
        files: [workflowChange({ headContent: "permissions: write-all\njobs: {}\n" })],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/dangerous-pattern",
    );
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
  });
});
