import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const packages = ["utils", "config", "git", "docker", "process", "plugin-api", "core"];

export default defineConfig({
  resolve: {
    alias: Object.fromEntries(
      packages.map((name) => [`@alfroul/${name}`, resolve(__dirname, `packages/${name}/src/index.ts`)])
    ),
  },
  test: {
    globals: true,
  },
});
