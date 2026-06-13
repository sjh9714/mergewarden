import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadReplayFixture, renderHumanReport, runCli } from "../src/replay.js";

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

  it("renders human replay output with decision, rule ids, messages, and paths", async () => {
    const input = await loadReplayFixture(await createTempFixture());
    const output = renderHumanReport(
      await import("@agent-gate/core").then(({ analyze }) => analyze(input)),
    );

    expect(output).toContain("Agent Gate: BLOCKED");
    expect(output).toContain("ERROR workflow/permission-escalation");
    expect(output).toContain("contents permission increased from read to write.");
    expect(output).toContain("ERROR workflow/dangerous-pattern");
    expect(output).toContain("Path: .github/workflows/release.yml");
    expect(output.endsWith("\n")).toBe(true);
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
