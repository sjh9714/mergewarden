import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

async function readPackageVersion(path: string): Promise<string> {
  const packageJson = JSON.parse(await readFile(join(repoRoot, path), "utf8")) as {
    version?: unknown;
  };

  if (typeof packageJson.version !== "string") {
    throw new Error(`${path} does not declare a string version`);
  }

  return packageJson.version;
}

async function readVersionConstant(path: string): Promise<string> {
  const source = await readFile(join(repoRoot, path), "utf8");
  const match = source.match(/export const MERGEWARDEN_VERSION = "([^"]+)";/);

  if (!match?.[1]) {
    throw new Error(`${path} does not export MERGEWARDEN_VERSION as a string constant`);
  }

  return match[1];
}

describe("version consistency", () => {
  it("keeps package versions and MergeWarden version constants in sync", async () => {
    const versions = await Promise.all([
      readPackageVersion("package.json"),
      readPackageVersion("packages/core/package.json"),
      readPackageVersion("packages/github/package.json"),
      readPackageVersion("packages/action/package.json"),
      readPackageVersion("packages/cli/package.json"),
      readVersionConstant("packages/core/src/version.ts"),
      readVersionConstant("packages/action/src/version.ts"),
      readVersionConstant("packages/cli/src/version.ts"),
    ]);

    expect(new Set(versions)).toEqual(new Set([versions[0]]));
  });
});
