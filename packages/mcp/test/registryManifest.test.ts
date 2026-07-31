import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function readJson(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(packageRoot, name), "utf8")) as Record<string, unknown>;
}

describe("MCP registry manifest", () => {
  it("keeps server.json and package.json agreeing on identity and version", async () => {
    const server = await readJson("server.json");
    const pkg = await readJson("package.json");
    const npmPackage = (server.packages as { identifier: string; version: string }[])[0];

    // The registry verifies ownership by matching package.json's mcpName against the server
    // name. A mismatch is only discovered at publish time, after the npm release is already
    // out, and fixing it means cutting another version.
    expect(pkg.mcpName).toBe(server.name);

    expect(npmPackage?.identifier).toBe(pkg.name);
    expect(server.version).toBe(pkg.version);
    expect(npmPackage?.version).toBe(pkg.version);
  });

  it("declares the fields the registry schema requires", async () => {
    const server = await readJson("server.json");
    const npmPackage = (server.packages as Record<string, unknown>[])[0];

    for (const field of ["name", "description", "version"]) {
      expect(server[field], `server.json must declare ${field}`).toBeTruthy();
    }
    for (const field of ["registryType", "identifier", "transport"]) {
      expect(npmPackage?.[field], `packages[0] must declare ${field}`).toBeTruthy();
    }

    expect(npmPackage?.registryType).toBe("npm");
    expect(server.name).toMatch(/^io\.github\.[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
  });
});
