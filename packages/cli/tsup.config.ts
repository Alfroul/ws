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
    "@ws/config",
    "@ws/core",
    "@ws/process",
    "@ws/git",
    "@ws/utils",
    "@ws/docker",
    "@ws/plugin-api",
  ],
  external: [
    "dockerode",
    "ssh2",
    "cpu-features",
  ],
  alias: {
    "@ws/config": resolve(pkgs, "config/src/index.ts"),
    "@ws/core": resolve(pkgs, "core/src/index.ts"),
    "@ws/process": resolve(pkgs, "process/src/index.ts"),
    "@ws/git": resolve(pkgs, "git/src/index.ts"),
    "@ws/docker": resolve(pkgs, "docker/src/index.ts"),
    "@ws/plugin-api": resolve(pkgs, "plugin-api/src/index.ts"),
  },
});
