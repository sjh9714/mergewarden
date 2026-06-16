import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node24",
  clean: true,
  dts: false,
  outExtension() {
    return {
      js: ".cjs",
    };
  },
  sourcemap: false,
  noExternal: [/.*/],
});
