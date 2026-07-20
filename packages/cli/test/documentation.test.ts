import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const ignoredDirectories = new Set([".git", "node_modules", "dist"]);

async function markdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(path)));
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(path);
    }
  }

  return files;
}

function relativeTargets(markdown: string): string[] {
  const targets: string[] = [];
  const linkPattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      continue;
    }

    const withoutTitle = raw.startsWith("<")
      ? raw.slice(1, raw.indexOf(">"))
      : raw.split(/\s+["']/)[0];
    const target = withoutTitle?.split("#", 1)[0];
    if (target) {
      targets.push(decodeURIComponent(target));
    }
  }

  return targets;
}

describe("documentation contracts", () => {
  it("keeps every relative Markdown link resolvable", async () => {
    const failures: string[] = [];

    for (const file of await markdownFiles(repoRoot)) {
      const markdown = await readFile(file, "utf8");
      for (const target of relativeTargets(markdown)) {
        try {
          await access(resolve(dirname(file), target));
        } catch {
          failures.push(`${relative(repoRoot, file)} -> ${target}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps the README concise and ordered around first value", async () => {
    const readme = await readFile(join(repoRoot, "README.md"), "utf8");
    const headings = [
      "# MergeWarden for AI PRs",
      "## Try It in 60 Seconds",
      "## Install in 30 Seconds",
      "## What It Catches",
      "## Adopt Safely",
      "## Trust Boundary",
      "## Documentation",
    ];
    let previous = -1;

    for (const heading of headings) {
      const index = readme.indexOf(heading);
      expect(index, `missing ${heading}`).toBeGreaterThan(previous);
      previous = index;
    }

    expect(readme.split("\n").length).toBeLessThanOrEqual(300);
    expect(readme.trim().split(/\s+/).length).toBeLessThanOrEqual(1_500);
    expect(readme).toContain("does not execute pull-request code");
    expect(readme).toContain("exact base commit");
    expect(readme).toContain("does not publish or recommend a mutable `v0` tag");
  });

  it("keeps npm publishing manual, approval-gated, pinned, and tied to fresh artifacts", async () => {
    const workflow = await readFile(join(repoRoot, ".github/workflows/publish-npm.yml"), "utf8");
    const actionUses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map(
      (match) => match[1] ?? "",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("environment: npm-release");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("npm install --global npm@11.18.0");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).toContain("git diff --exit-code -- packages/action/dist/index.cjs");
    expect(workflow).toContain('npm publish "$CLI_TARBALL" --provenance --access public');
    expect(actionUses.length).toBeGreaterThan(0);
    expect(actionUses.every((uses) => /@[0-9a-f]{40}$/.test(uses))).toBe(true);
  });
});
