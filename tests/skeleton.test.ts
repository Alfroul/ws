import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

describe("Skeleton Tests", () => {
  it("ws --version outputs correct version", () => {
    const output = execSync(`node "${root}/packages/cli/dist/index.js" --version`, {
      encoding: "utf-8",
    });
    expect(output.trim()).toBe("0.1.0");
  });

  it("parseConfig function signature exists", async () => {
    const { parseConfig } = await import("../packages/config/src/parser.js");
    expect(typeof parseConfig).toBe("function");
  });

  it("topologicalSort function signature exists", async () => {
    const { topologicalSort } = await import("../packages/core/src/scheduler.js");
    expect(typeof topologicalSort).toBe("function");
  });

  it("GitManager class is instantiable", async () => {
    const { GitManager } = await import("../packages/git/src/manager.js");
    const manager = new GitManager("https://example.com/repo.git", "main", "/tmp/test");
    expect(manager).toBeInstanceOf(GitManager);
  });

  it("DockerManager class is instantiable", async () => {
    const { DockerManager } = await import("../packages/docker/src/manager.js");
    const manager = new DockerManager();
    expect(manager).toBeInstanceOf(DockerManager);
  });

  it("ProcessManager class is instantiable", async () => {
    const { ProcessManager } = await import("../packages/process/src/manager.js");
    const manager = new ProcessManager();
    expect(manager).toBeInstanceOf(ProcessManager);
  });
});
