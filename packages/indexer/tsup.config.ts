import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node20",
  clean: true,
  // The shared config package ships TypeScript source, so it is bundled in.
  noExternal: ["@nabb/config"],
});
