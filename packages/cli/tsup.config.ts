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
    js: 'import { createRequire as __mergeWardenCreateRequire } from "node:module"; const require = __mergeWardenCreateRequire(import.meta.url);',
  },
});
