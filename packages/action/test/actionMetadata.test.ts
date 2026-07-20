import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const requireFromCore = createRequire(join(repoRoot, "packages/core/package.json"));
const { parse } = requireFromCore("yaml") as { parse(text: string): unknown };
const rootAction = readFileSync(join(repoRoot, "action.yml"), "utf8");
const packageAction = readFileSync(join(repoRoot, "packages/action/action.yml"), "utf8");
const selfDogfoodingWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/mergewarden.yml"),
  "utf8",
);

describe("action metadata", () => {
  it("exposes matching root and package-local action metadata", () => {
    const rootMetadata = parse(rootAction) as Record<string, unknown> & {
      runs: { main: string };
    };
    const packageMetadata = parse(packageAction) as Record<string, unknown> & {
      runs: { main: string };
    };

    expect(rootMetadata.runs.main).toBe("packages/action/dist/index.cjs");
    expect(packageMetadata.runs.main).toBe("dist/index.cjs");

    rootMetadata.runs.main = "<action-bundle>";
    packageMetadata.runs.main = "<action-bundle>";
    expect(rootMetadata).toEqual(packageMetadata);
  });

  it("keeps self-dogfooding API-only and checkout-free", () => {
    expect(selfDogfoodingWorkflow).not.toContain("actions/checkout");
    expect(selfDogfoodingWorkflow).toContain("contents: read");
  });
});
