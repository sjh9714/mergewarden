import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analyze } from "@agent-gate/core";
import { loadReplayFixture, renderHumanReport, runCli } from "../src/replay.js";
import { AGENT_GATE_VERSION } from "../src/version.js";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const baseWorkflow = "permissions:\n  contents: read\n";
const headWorkflow =
  "'on':\n  pull_request_target:\npermissions:\n  contents: write\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n";

async function createTempFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-gate-replay-"));
  await writeFile(join(dir, "agent-gate.yml"), "version: 1\nmode: block\n");
  await writeFile(join(dir, "pr-body.md"), "");
  await writeFile(
    join(dir, "fixture.json"),
    JSON.stringify(
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
      null,
      2,
    ),
  );

  return dir;
}

async function createFixture(
  fixture: Record<string, unknown>,
  options: { config?: string; prBody?: string } = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-gate-replay-custom-"));
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
    expectedPath: ".github/workflows/release.yml",
    expectedDecision: "block",
    expectedSeverity: "error",
  },
  {
    name: "agent-control-plane-drift",
    expectedRuleIds: ["agent-control-plane/drift"],
    expectedPath: "AGENTS.md",
    expectedDecision: "block",
    expectedSeverity: "error",
  },
  {
    name: "out-of-scope-agent-edit",
    expectedRuleIds: ["contract/out-of-scope"],
    expectedPath: "src/payments/webhook.ts",
    expectedDecision: "block",
    expectedSeverity: "error",
  },
  {
    name: "missing-test-evidence",
    expectedRuleIds: ["risk/high-risk-path", "evidence/missing-test-change"],
    expectedPath: "src/auth/session.ts",
    expectedDecision: "block",
    expectedSeverity: "error",
  },
  {
    name: "mcp-config-drift",
    expectedRuleIds: ["agent-control-plane/drift"],
    expectedPath: ".mcp.json",
    expectedDecision: "block",
    expectedSeverity: "error",
  },
  {
    name: "package-lifecycle-script-added",
    expectedRuleIds: ["dependency/lifecycle-script-added"],
    expectedPath: "package.json",
    expectedDecision: "warn",
    expectedSeverity: "warn",
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
    expect(input.changes.totals).toEqual({
      filesChanged: 1,
      additions: 12,
      deletions: 1,
    });
  });

  it("defaults replay metadata to the current Agent Gate version", async () => {
    const input = await loadReplayFixture(
      await createFixture({
        files: [],
      }),
    );

    expect(input.version).toBe(AGENT_GATE_VERSION);
  });

  it("renders human replay output with decision, rule ids, messages, and paths", async () => {
    const input = await loadReplayFixture(await createTempFixture());
    const output = renderHumanReport(await analyze(input));

    expect(output).toContain("Agent Gate: BLOCKED");
    expect(output).toContain("ERROR workflow/permission-escalation");
    expect(output).toContain("contents permission increased from read to write.");
    expect(output).toContain("ERROR workflow/dangerous-pattern");
    expect(output).toContain("Path: .github/workflows/release.yml");
    expect(output.endsWith("\n")).toBe(true);
  });

  it("documents the headline replay output in the README", async () => {
    const readme = await readFile(join(repoRoot, "README.md"), "utf8");

    expect(readme).toContain("@v0.2.5");
    expect(readme).not.toContain("v0.2.4+");
    expect(readme).toContain("checkout-free GitHub Action");
    expect(readme).toContain(
      "deterministic evidence when AI-generated PRs cross risky policy boundaries",
    );
    expect(readme).toContain("It checks workflow permissions, PR scope contracts");
    expect(readme).toContain("Policy boundaries for AI PRs, backed by repeatable evidence");
    expect(readme.toLowerCase()).toContain("no checkout");
    expect(readme).toContain("Catch risky AI-generated PRs before merge");
    expect(readme).toContain("[30-second install](#30-second-install)");
    expect(readme).toContain("[Tune policy](#after-the-first-run-tune-policy)");
    expect(readme).toContain("[Example report](#real-report-example)");
    expect(readme).toContain("[Action reference](#action-reference)");
    expect(readme).toContain("[Evidence model](docs/evidence-model.md)");
    expect(readme.indexOf("## 30-Second Install")).toBeLessThan(
      readme.indexOf("## Real Report Example"),
    );
    expect(readme).toContain("Real Report Example");
    expect(readme).toContain("docs/first-report.md");
    expect(readme).toContain("docs/demo-prs.md");
    expect(readme).toContain(
      "https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/11",
    );
    expect(readme).toContain("What Agent Gate Does Not Do");
    expect(readme).toContain("prove that a PR is semantically correct");
    expect(readme).toContain("When To Use Agent Gate");
    expect(readme).toContain("Why Deterministic?");
    expect(readme).toContain("30-Second Install");
    expect(readme).toContain("Windows PowerShell");
    expect(readme).toContain("Invoke-WebRequest");
    expect(readme).toContain("New-Item -ItemType Directory -Force .github/workflows");
    expect(readme).toContain("templates/agent-gate-observe.yml");
    expect(readme).toContain(
      "raw.githubusercontent.com/sjh9714/Agent-Gate/v0.2.5/templates/agent-gate-observe.yml",
    );
    expect(readme).toContain("does not execute a remote");
    expect(readme).toContain("Commit `.github/workflows/agent-gate.yml`.");
    expect(readme).toContain("Read the Agent Gate job summary.");
    expect(readme).toContain("package.json added a preinstall script");
    expect(readme).toContain("review the lifecycle script before merging");
    expect(readme).toContain("Policy source: built-in default");
    expect(readme).toContain("What Runs Without `agent-gate.yml`?");
    expect(readme).toContain("First run without config");
    expect(readme).toContain("only when a contract exists");
    expect(readme).toContain("After The First Run: Tune Policy");
    expect(readme).toContain("start in warn mode");
    expect(readme).toContain("built-in default policy");
    expect(readme).toContain("configSource: default");
    expect(readme).toContain("Once tuned, Agent Gate can report contract-scope evidence too");
    expect(readme).toContain("That released default policy gives");
    expect(readme).toContain(
      "Starting in `v0.2.4`, the built-in default policy also includes warning-mode",
    );
    expect(readme).toContain("package lifecycle script drift checks. Repository-specific checks");
    expect(readme).toContain("Repository-specific checks");
    expect(readme).toContain("allowed_paths");
    expect(readme).toContain("Action Reference");
    expect(readme).toContain("| `config`");
    expect(readme).toContain("| `agent-gate.yml`");
    expect(readme).toContain("default path is confirmed missing");
    expect(readme).toContain("| `decision`");
    expect(readme).toContain("Final decision: `pass`, `warn`, or `block`.");
    expect(readme).toContain(
      "`mode` controls rollout behavior. `decision` is the analyzer result.",
    );
    expect(readme).toContain("Status And Roadmap");
    expect(readme).toContain("Latest external install smoke evidence is recorded in");
    expect(readme).toContain("docs/external-install-smoke-v0.2.5.md");
    expect(readme).toContain("safe to observe");
    expect(readme).toContain("needs human decision");
    expect(readme).toContain("must block");
    expect(readme).toContain("Agent Gate: NEEDS HUMAN DECISION");
    expect(readme).toContain("Finding ID: agf_...");
    expect(readme).toContain("Agent Gate: BLOCKED");
    expect(readme).toContain("workflow/permission-escalation");
    expect(readme).toContain("workflow/dangerous-pattern");
    expect(readme).toContain("agent-control-plane/drift");
    expect(readme).toContain("Package lifecycle script drift");
    expect(readme).toContain("docs/rules/package-lifecycle-scripts.md");
    expect(readme).toContain("package-lifecycle-script-added");
    expect(readme).toContain("package_scripts:");
    expect(readme).toContain("preinstall");
    expect(readme).toContain(
      "Dependency additions and lockfile mismatch checks remain future work.",
    );
    expect(readme).toContain(".github/workflows/release.yml");
  });

  it("documents how to read the first Agent Gate report", async () => {
    const firstReport = await readFile(join(repoRoot, "docs", "first-report.md"), "utf8");

    expect(firstReport).toContain("Your First Agent Gate Report");
    expect(firstReport).toContain("PASSED");
    expect(firstReport).toContain("NEEDS HUMAN DECISION");
    expect(firstReport).toContain("BLOCKED");
    expect(firstReport).toContain("Finding ID");
    expect(firstReport).toContain("Evidence Snapshot");
    expect(firstReport).toContain("Policy source");
    expect(firstReport).toContain("configSource: default");
    expect(firstReport).toContain("not proof that a pull request is unsafe");
    expect(firstReport).toContain("does not prove semantic correctness");
    expect(firstReport).toContain("Treat `NEEDS HUMAN DECISION` as a review prompt");
  });

  it("keeps the observe-mode install template checkout-free and tag-pinned", async () => {
    const template = await readFile(join(repoRoot, "templates", "agent-gate-observe.yml"), "utf8");

    expect(template).toContain("contents: read");
    expect(template).toContain("pull-requests: read");
    expect(template).toContain("uses: sjh9714/Agent-Gate@v0.2.5");
    expect(template).toContain("mode: warn");
    expect(template).toContain("fail-on-block: false");
    expect(template).not.toContain("actions/checkout");
    expect(template).not.toContain("run:");
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
    async ({ name, expectedRuleIds, expectedPath, expectedDecision, expectedSeverity }) => {
      const input = await loadReplayFixture(unsafePrZooFixturePath(name));
      const result = await analyze(input);
      const output = renderHumanReport(result);

      expect(result.decision).toBe(expectedDecision);
      expect(result.findings.map((finding) => finding.ruleId)).toEqual(expectedRuleIds);
      expect(result.findings[0]?.severity).toBe(expectedSeverity);
      expect(output).toContain(
        expectedDecision === "block" ? "Agent Gate: BLOCKED" : "Agent Gate: WARN",
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

  it("preserves pr-body.md content over fixture PR body", async () => {
    const input = await loadReplayFixture(
      await createFixture(
        {
          pr: { body: "fixture body" },
          files: [],
        },
        { prBody: "file body" },
      ),
    );

    expect(input.pr.body).toBe("file body");
  });

  it("preserves empty pr-body.md over fixture PR body", async () => {
    const input = await loadReplayFixture(
      await createFixture(
        {
          pr: { body: "fixture body" },
          files: [],
        },
        { prBody: "" },
      ),
    );

    expect(input.pr.body).toBe("");
  });

  it("falls back to fixture PR body when pr-body.md is missing", async () => {
    const input = await loadReplayFixture(
      await createFixture({
        pr: { body: "fixture body" },
        files: [],
      }),
    );

    expect(input.pr.body).toBe("fixture body");
  });

  it("returns deterministic errors for missing fixture directories", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(["replay", join(tmpdir(), "missing-agent-gate-fixture")], {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(2);
    expect(stdout).toEqual([]);
    expect(stderr.join("")).toContain("Agent Gate CLI error:");
    expect(stderr.join("")).not.toContain("Error:");
  });

  it("returns deterministic errors for invalid fixture JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-gate-replay-invalid-"));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "agent-gate.yml"), "version: 1\n");
    await writeFile(join(dir, "fixture.json"), "{");

    const stderr: string[] = [];
    const exitCode = await runCli(["replay", dir], {
      stdout: () => undefined,
      stderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toContain("Agent Gate CLI error:");
    expect(stderr.join("")).not.toContain("SyntaxError");
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
    const fixtureDir = await createFixture({ files: [file] });
    const stderr: string[] = [];
    const exitCode = await runCli(["replay", fixtureDir], {
      stdout: () => undefined,
      stderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(2);
    expect(stderr.join("")).toContain("Agent Gate CLI error:");
    expect(stderr.join("")).not.toContain("TypeError");
  });
});
