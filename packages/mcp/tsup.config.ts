import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: false,
  // The MCP SDK stays external: it is a real dependency of this package, and bundling a
  // protocol implementation the host may also load invites two copies of it. Core is
  // bundled, as it is in the CLI.
  external: ["@modelcontextprotocol/sdk"],
  noExternal: ["@mergewarden/core"],
  banner: {
    // The shebang must be the first bytes of the file. The createRequire shim follows it
    // because bundled CommonJS interop still reaches for require() at runtime, which an ESM
    // module does not otherwise have.
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __mergeWardenCreateRequire } from "node:module";',
      "const require = __mergeWardenCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});
