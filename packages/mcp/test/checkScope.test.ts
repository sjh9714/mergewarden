import { describe, expect, it } from "vitest";
import { parseContractFromPrBody } from "@mergewarden/core";

import { checkScope, contractBlock } from "../src/checkScope.js";

describe("checkScope", () => {
  it("passes when every changed path is inside the declared scope", async () => {
    const result = await checkScope({
      allowedPaths: ["src/auth/**"],
      changedPaths: ["src/auth/login.ts", "src/auth/session.ts"],
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.summary).toContain("inside the declared scope");
  });

  it("names each path that escaped the declared scope", async () => {
    const result = await checkScope({
      allowedPaths: ["src/auth/**"],
      changedPaths: ["src/auth/login.ts", "src/billing/invoice.ts", "README.md"],
    });

    expect(result.ok).toBe(false);
    const escaped = result.findings.filter((f) => f.ruleId === "contract/out-of-scope");
    expect(escaped.map((f) => f.path).sort()).toEqual(["README.md", "src/billing/invoice.ts"]);
  });

  it("flags an edit to the agent's own instruction file", async () => {
    const result = await checkScope({
      allowedPaths: ["**"],
      changedPaths: ["CLAUDE.md"],
    });

    expect(result.findings.map((f) => f.ruleId)).toContain("agent-control-plane/drift");
    expect(result.summary).toContain("steer every future agent run");
  });

  it("reports blocked paths separately from out-of-scope ones", async () => {
    const result = await checkScope({
      allowedPaths: ["**"],
      blockedPaths: [".github/workflows/**"],
      changedPaths: [".github/workflows/release.yml"],
    });

    expect(result.findings.map((f) => f.ruleId)).toContain("contract/blocked-path");
  });

  it("says plainly that nothing could be checked when no scope was declared", async () => {
    const result = await checkScope({ allowedPaths: [], changedPaths: ["src/anything.ts"] });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("No scope was declared");
  });

  it("does not surface rules that need file contents", async () => {
    // The caller supplies paths, not diffs. Reporting a workflow or dependency finding from a
    // path alone would be a guess, so those rules must not appear even when the path matches.
    const result = await checkScope({
      allowedPaths: ["**"],
      changedPaths: [".github/workflows/ci.yml", "package.json"],
    });

    for (const finding of result.findings) {
      expect(finding.ruleId.startsWith("workflow/")).toBe(false);
      expect(finding.ruleId.startsWith("dependency/")).toBe(false);
    }
  });

  it("does not report agent origin, which the caller already knows", async () => {
    const result = await checkScope({ allowedPaths: ["src/**"], changedPaths: ["src/a.ts"] });

    expect(result.findings.map((f) => f.ruleId)).not.toContain("agent/origin-detected");
  });
});

describe("contractBlock", () => {
  it.each(["", " ", "src/a.ts ", "\tsrc/**"])(
    "rejects scope paths that the Action schema would alter: %j",
    async (path) => {
      expect(() => contractBlock({ allowedPaths: [path], changedPaths: [] })).toThrow(
        "Scope paths must be non-empty",
      );
      await expect(
        checkScope({ allowedPaths: ["**"], blockedPaths: [path], changedPaths: [path] }),
      ).rejects.toThrow("Scope paths must be non-empty");
    },
  );

  it("does not emit an invalid empty contract or whitespace-only task", () => {
    expect(contractBlock({ allowedPaths: [], changedPaths: [] })).toBe("");
    expect(
      parseContractFromPrBody(
        contractBlock({ allowedPaths: ["**"], changedPaths: [], task: " \n " }),
      ),
    ).toEqual({ kind: "valid", contract: { version: 1, allowed_paths: ["**"] } });
  });

  it("preserves real changed filenames with trailing spaces", async () => {
    const result = await checkScope({ allowedPaths: ["**"], changedPaths: ["src/a.ts "] });
    expect(result.ok).toBe(true);
  });
  it.each([
    "**",
    "*.ts",
    "#notes",
    "src/a: b.ts",
    "src/line\nbreak.ts",
    "src/-->/file.ts",
    "src/\u0085\u2028\u2029.ts",
  ])("round trips the literal path %s through the Action parser", (path) => {
    const request = {
      allowedPaths: [path],
      blockedPaths: [path],
      changedPaths: [],
      task: "Fix parser",
    };
    const parsed = parseContractFromPrBody(contractBlock(request));
    expect(parsed).toEqual({
      kind: "valid",
      contract: {
        version: 1,
        allowed_paths: [path],
        blocked_paths: [path],
        task: request.task,
      },
    });
  });

  it("keeps YAML syntax and comment delimiters inside the task string", () => {
    const task = "Fix: parser --> <!-- mergewarden-contract boundary";
    expect(
      parseContractFromPrBody(contractBlock({ allowedPaths: ["src/**"], changedPaths: [], task })),
    ).toEqual({ kind: "valid", contract: { version: 1, allowed_paths: ["src/**"], task } });
  });

  it("renders a block the gate can parse back", async () => {
    const block = contractBlock({
      allowedPaths: ["src/auth/**", "test/auth/**"],
      blockedPaths: [".github/**"],
      changedPaths: [],
      task: "update session expiry",
    });

    expect(block).toBe(
      [
        "<!-- mergewarden-contract",
        "version: 1",
        'task: "update session expiry"',
        "allowed_paths:",
        '  - "src/auth/**"',
        '  - "test/auth/**"',
        "blocked_paths:",
        '  - ".github/**"',
        "-->",
      ].join("\n"),
    );
  });

  it("keeps a multi-line task on one line so the block stays parseable", () => {
    const block = contractBlock({
      allowedPaths: ["src/**"],
      changedPaths: [],
      task: "first line\nsecond line",
    });

    expect(block).toContain('task: "first line second line"');
    expect(block.split("\n").filter((l) => l.startsWith("task:"))).toHaveLength(1);
  });
});
