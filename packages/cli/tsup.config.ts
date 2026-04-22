import { defineConfig } from "tsup";
import { resolve } from "node:path";

const pkgs = resolve(import.meta.dirname, "..");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: [
    "@alfroul/config",
    "@alfroul/core",
    "@alfroul/process",
    "@alfroul/git",
    "@alfroul/utils",
    "@alfroul/docker",
    "@alfroul/plugin-api",
  ],
  external: [
    "dockerode",
    "ssh2",
    "cpu-features",
  ],
  alias: {
    "@alfroul/config": resolve(pkgs, "config/src/index.ts"),
    "@alfroul/core": resolve(pkgs, "core/src/index.ts"),
    "@alfroul/process": resolve(pkgs, "process/src/index.ts"),
    "@alfroul/git": resolve(pkgs, "git/src/index.ts"),
    "@alfroul/docker": resolve(pkgs, "docker/src/index.ts"),
    "@alfroul/plugin-api": resolve(pkgs, "plugin-api/src/index.ts"),
  },
});
