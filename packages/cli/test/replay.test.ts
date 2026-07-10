import { mkdtemp, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analyze } from "@agent-gate/core";
import { loadReplayFixture, renderHumanReport, runCli, safeTerminalValue } from "../src/replay.js";
import { AGENT_GATE_VERSION } from "../src/version.js";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const baseWorkflow = "permissions:\n  contents: read\n";
const headWorkflow =
  "'on':\n  pull_request_target:\npermissions:\n  contents: write\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n";

async function createTempFixture(): Promise<string> {
  return createFixture(
    {
      repo: {
        baseSha: "base-workflow",
        headSha: "head-workflow",
      },
      pr: {
        number: 7,
        title: "Escalate workflow permissions",
        branchName: "codex/workflow-permission-escalation",
      },
      files: [
        {
          path: ".github/workflows/release.yml",
          status: "modified",
          additions: 12,
          deletions: 1,
          baseContent: baseWorkflow,
          headContent: headWorkflow,
        },
      ],
      now: "2026-06-13T00:00:00.000Z",
      version: "0.0.0-test",
    },
    { config: "version: 1\nmode: block\n", prBody: "" },
  );
}

async function createFixture(
  fixture: Record<string, unknown>,
  options: { config?: string; prBody?: string } = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-gate-replay-"));
  await writeFile(join(dir, "agent-gate.yml"), options.config ?? "version: 1\nmode: block\n");
  if (options.prBody !== undefined) {
    await writeFile(join(dir, "pr-body.md"), options.prBody);
  }
  await writeFile(join(dir, "fixture.json"), JSON.stringify(fixture, null, 2));
  return dir;
}

const unsafePrZooFixtures = [
  {
    name: "workflow-permission-escalation",
    expectedRuleIds: ["workflow/permission-escalation", "workflow/dangerous-pattern"],
    expectedSeverities: ["error", "error"],
    expectedPath: ".github/workflows/release.yml",
    expectedDecision: "block",
  },
  {
    name: "agent-control-plane-drift",
    expectedRuleIds: ["agent-control-plane/drift"],
    expectedSeverities: ["error"],
    expectedPath: "AGENTS.md",
    expectedDecision: "block",
  },
  {
    name: "out-of-scope-agent-edit",
    expectedRuleIds: ["contract/out-of-scope"],
    expectedSeverities: ["error"],
    expectedPath: "src/payments/webhook.ts",
    expectedDecision: "block",
  },
  {
    name: "missing-test-evidence",
    expectedRuleIds: ["risk/high-risk-path", "evidence/missing-test-change"],
    expectedSeverities: ["error", "error"],
    expectedPath: "src/auth/session.ts",
    expectedDecision: "block",
  },
  {
    name: "mcp-config-drift",
    expectedRuleIds: ["agent-control-plane/drift"],
    expectedSeverities: ["error"],
    expectedPath: ".mcp.json",
    expectedDecision: "block",
  },
  {
    name: "package-lifecycle-script-added",
    expectedRuleIds: ["dependency/lifecycle-script-added"],
    expectedSeverities: ["warn"],
    expectedPath: "package.json",
    expectedDecision: "warn",
  },
  {
    name: "composite-agent-boundary",
    expectedRuleIds: [
      "agent/origin-detected",
      "contract/out-of-scope",
      "contract/out-of-scope",
      "contract/out-of-scope",
      "contract/out-of-scope",
      "agent-control-plane/drift",
      "agent-control-plane/drift",
      "dependency/lifecycle-script-added",
      "workflow/permission-escalation",
      "workflow/permission-escalation",
      "workflow/dangerous-pattern",
      "workflow/dangerous-pattern",
      "workflow/dangerous-pattern",
      "workflow/dangerous-pattern",
      "workflow/agentic-untrusted-input",
    ],
    expectedSeverities: [
      "info",
      "error",
      "error",
      "error",
      "error",
      "error",
      "error",
      "warn",
      "error",
      "error",
      "error",
      "error",
      "error",
      "error",
      "error",
    ],
    expectedPath: ".github/workflows/release.yml",
    expectedDecision: "block",
  },
];

function unsafePrZooFixturePath(name: string): string {
  return join(repoRoot, "fixtures", "unsafe-pr-zoo", name);
}

describe("CLI replay", () => {
  it("loads replay fixtures into analysis input", async () => {
    const input = await loadReplayFixture(await createTempFixture());

    expect(input.repo.baseSha).toBe("base-workflow");
    expect(input.pr.number).toBe(7);
    expect(input.config.mode).toBe("block");
    expect(input.contract.kind).toBe("missing");
    expect(input.changes.files[0]).toMatchObject({
      path: ".github/workflows/release.yml",
      baseContent: baseWorkflow,
      headContent: headWorkflow,
    });
    expect(input.changes.totals).toEqual({ filesChanged: 1, additions: 12, deletions: 1 });
  });

  it("defaults replay metadata to the current Agent Gate version", async () => {
    const input = await loadReplayFixture(await createFixture({ files: [] }));
    expect(input.version).toBe(AGENT_GATE_VERSION);
  });

  it("renders human replay output with status, rules, evidence, and paths", async () => {
    const output = renderHumanReport(
      await analyze(await loadReplayFixture(await createTempFixture())),
    );

    expect(output).toContain("Agent Gate: BLOCKED");
    expect(output).toContain("Analysis: complete");
    expect(output).toContain("Files analyzed: 1 of 1");
    expect(output).toContain("ERROR workflow/permission-escalation");
    expect(output).toContain("contents permission increased from read to write at workflow scope");
    expect(output).toContain("- permission_scope: workflow");
    expect(output).toContain("- affected_capability: repository_content_writes");
    expect(output).toContain("Path: .github/workflows/release.yml");
    expect(output.endsWith("\n")).toBe(true);
  });

  it("reports both retained-surface and upstream omitted findings", async () => {
    const result = await analyze(await loadReplayFixture(await createTempFixture()));
    const firstFinding = result.findings[0];

    if (!firstFinding) {
      throw new Error("Expected a replay finding");
    }

    const output = renderHumanReport({
      ...result,
      findings: Array.from({ length: 12 }, (_, index) => ({
        ...firstFinding,
        findingId: `agf_${String(index).padStart(16, "0")}`,
      })),
      metadata: { ...result.metadata, omittedFindingCount: 7 },
    });

    expect(output).toContain("9 additional finding(s) omitted from this surface.");
    expect(output).toContain(
      "Full retained report: rerun with --format json or --format markdown.",
    );
  });

  it("neutralizes terminal control sequences, injected lines, and mentions", async () => {
    const result = await analyze(await loadReplayFixture(await createTempFixture()));
    const finding = result.findings[0];
    expect(finding).toBeDefined();

    const output = renderHumanReport({
      ...result,
      findings: [
        {
          ...finding!,
          message: "normal\n# Agent Gate: PASSED\u001b[2J @everyone",
          path: "src/\u001b[31mred\u001b[0m\rfile.ts",
          evidence: [{ label: "value\tname", value: "line one\n## fake heading" }],
        },
      ],
    });

    expect(output).not.toContain("\u001b");
    expect(output).not.toContain("\n# Agent Gate: PASSED");
    expect(output).not.toContain("@everyone");
    expect(output).toContain("normal\\n# Agent Gate: PASSED");
    expect(output).toContain("@\u200beveryone");
    expect(output).toContain("src/red\\rfile.ts");
    expect(output).toContain("value\\tname: line one\\n## fake heading");
  });

  it("caps terminal previews and attaches a stable SHA-256 digest", () => {
    const value = "가".repeat(1_000);
    const safe = safeTerminalValue(value);

    expect(Buffer.byteLength(safe, "utf8")).toBeLessThan(2_150);
    expect(safe).toMatch(/… \[sha256:[a-f0-9]{64}\]$/);
    expect(safeTerminalValue(value)).toBe(safe);
  });

  it("prints JSON replay output that parses as an analysis result", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(["replay", await createTempFixture(), "--format", "json"], {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    const result = JSON.parse(stdout.join(""));
    expect(result.decision).toBe("block");
    expect(result.findings.map((finding: { ruleId: string }) => finding.ruleId)).toContain(
      "workflow/permission-escalation",
    );
  });

  it.each(unsafePrZooFixtures)(
    "replays unsafe-pr-zoo/$name with expected findings",
    async ({ name, expectedRuleIds, expectedSeverities, expectedPath, expectedDecision }) => {
      const result = await analyze(await loadReplayFixture(unsafePrZooFixturePath(name)));
      const output = renderHumanReport(result);

      expect(result.decision).toBe(expectedDecision);
      expect(result.findings.map((finding) => finding.ruleId)).toEqual(expectedRuleIds);
      expect(result.findings.map((finding) => finding.severity)).toEqual(expectedSeverities);
      expect(output).toContain(
        expectedDecision === "block" ? "Agent Gate: BLOCKED" : "Agent Gate: NEEDS REVIEW",
      );
      expect(output).toContain(expectedRuleIds[0]);
      expect(output).toContain(`Path: ${expectedPath}`);
    },
  );

  it("returns exit code 0 for warn decisions", async () => {
    const fixtureDir = await createFixture(
      {
        files: [
          {
            path: "src/payments/webhook.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
          },
        ],
      },
      {
        config:
          "version: 1\nmode: block\nhigh_risk_paths:\n  payments:\n    paths:\n      - src/payments/**\n    severity: warn\n",
      },
    );

    const exitCode = await runCli(["replay", fixtureDir], {
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(exitCode).toBe(0);
  });

  it("prefers pr-body.md, including an empty file, and falls back when absent", async () => {
    const fromFile = await loadReplayFixture(
      await createFixture({ pr: { body: "fixture body" }, files: [] }, { prBody: "file body" }),
    );
    const fromEmptyFile = await loadReplayFixture(
      await createFixture({ pr: { body: "fixture body" }, files: [] }, { prBody: "" }),
    );
    const fromFixture = await loadReplayFixture(
      await createFixture({ pr: { body: "fixture body" }, files: [] }),
    );

    expect(fromFile.pr.body).toBe("file body");
    expect(fromEmptyFile.pr.body).toBe("");
    expect(fromFixture.pr.body).toBe("fixture body");
  });

  it("returns deterministic errors for missing or invalid fixtures", async () => {
    const errors: string[] = [];
    const missingCode = await runCli(["replay", join(tmpdir(), "missing-agent-gate-fixture")], {
      stdout: () => undefined,
      stderr: (text) => errors.push(text),
    });
    const invalidDir = await createFixture({ files: [] });
    await writeFile(join(invalidDir, "fixture.json"), "{");
    const invalidCode = await runCli(["replay", invalidDir], {
      stdout: () => undefined,
      stderr: (text) => errors.push(text),
    });

    expect(missingCode).toBe(2);
    expect(invalidCode).toBe(2);
    expect(errors.join("")).toContain("Agent Gate CLI error:");
    expect(errors.join("")).not.toContain("SyntaxError");
  });

  it("sanitizes attacker-controlled fixture paths in stderr", async () => {
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["replay", join(tmpdir(), "missing\n# Agent Gate: PASSED\u001b[2J@everyone")],
      {
        stdout: () => undefined,
        stderr: (text) => stderr.push(text),
      },
    );
    const output = stderr.join("");

    expect(exitCode).toBe(2);
    expect(output).not.toContain("\u001b");
    expect(output).not.toContain("\n# Agent Gate: PASSED");
    expect(output).not.toContain("@everyone");
    expect(output).toContain("\\n# Agent Gate: PASSED");
    expect(output).toContain("@\u200beveryone");
  });

  it.each([
    ["missing file.path", { status: "modified", additions: 1, deletions: 0 }],
    ["invalid file.status", { path: "src/app.ts", status: "changed", additions: 1, deletions: 0 }],
    [
      "invalid file.additions",
      { path: "src/app.ts", status: "modified", additions: -1, deletions: 0 },
    ],
    [
      "invalid file.deletions",
      { path: "src/app.ts", status: "modified", additions: 1, deletions: 1.5 },
    ],
  ])("returns deterministic errors for %s", async (_name, file) => {
    const stderr: string[] = [];
    const exitCode = await runCli(["replay", await createFixture({ files: [file] })], {
      stdout: () => undefined,
      stderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toContain("Agent Gate CLI error:");
    expect(stderr.join("")).not.toContain("TypeError");
  });
});
