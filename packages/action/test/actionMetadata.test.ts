import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const rootAction = readFileSync(join(repoRoot, "action.yml"), "utf8");
const packageAction = readFileSync(join(repoRoot, "packages/action/action.yml"), "utf8");
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const selfDogfoodingWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/agent-gate.yml"),
  "utf8",
);

const importantInputs = [
  "github-token",
  "mode",
  "fail-on-block",
  "comment",
  "report-json",
  "report-markdown",
];
const importantOutputs = ["decision", "risk-score", "report-json", "report-markdown"];

describe("action metadata", () => {
  it("exposes matching root and package-local action metadata", () => {
    expect(rootAction).toContain('main: "packages/action/dist/index.cjs"');
    expect(packageAction).toContain('main: "dist/index.cjs"');

    for (const input of importantInputs) {
      expect(rootAction).toContain(`  ${input}:`);
      expect(packageAction).toContain(`  ${input}:`);
    }

    for (const output of importantOutputs) {
      expect(rootAction).toContain(`  ${output}:`);
      expect(packageAction).toContain(`  ${output}:`);
    }
  });

  it("documents comment permissions without adding checkout to self-dogfooding", () => {
    expect(readme).toContain("issues: write");
    expect(readme).toContain("comment: true");
    expect(selfDogfoodingWorkflow).not.toContain("actions/checkout");
  });
});
