import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  clean: true,
  dts: false,
  sourcemap: false,
  noExternal: [/.*/],
  banner: {
    js: 'import { createRequire as __agentGateCreateRequire } from "node:module"; const require = __agentGateCreateRequire(import.meta.url);',
  },
});
