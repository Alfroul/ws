import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: {
    compilerOptions: {
      composite: false,
      rootDir: undefined as unknown as string,
    },
  },
  clean: true,
  sourcemap: true,
});
