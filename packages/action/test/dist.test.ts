import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("committed action bundle", () => {
  it("loads without ESM dynamic require crashes", () => {
    const actionYaml = readFileSync(join(packageRoot, "action.yml"), "utf8");
    expect(actionYaml).toContain('main: "dist/index.cjs"');

    const result = spawnSync(process.execPath, ["dist/index.cjs"], {
      cwd: packageRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        "INPUT_GITHUB-TOKEN": "",
      },
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(output).not.toContain("Dynamic require");
    expect(output).toContain("MergeWarden requires the github-token input.");
  });
});
