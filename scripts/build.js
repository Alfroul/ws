import { execSync } from "node:child_process";
import { resolve } from "node:path";

const packages = [
  "packages/utils",
  "packages/config",
  "packages/git",
  "packages/docker",
  "packages/process",
  "packages/plugin-api",
  "packages/core",
  "packages/cli",
  "plugins/notifications",
  "plugins/health-check",
];

const root = resolve(import.meta.dirname, "..");

for (const pkg of packages) {
  const cwd = resolve(root, pkg);
  console.log(`Building ${pkg}...`);
  try {
    execSync("npx tsup", { cwd, stdio: "inherit" });
  } catch {
    console.error(`Failed to build ${pkg}`);
    process.exit(1);
  }
}

console.log("\nAll packages built successfully!");
