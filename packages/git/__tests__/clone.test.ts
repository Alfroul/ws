import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cloneRepo } from "../src/clone.js";
import { GitManager } from "../src/manager.js";

const TEST_REPO = "https://github.com/octocat/Hello-World.git";
let tempDir: string | undefined;

function getTempDir(): string {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-git-clone-test-"));
  }
  return tempDir;
}

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("cloneRepo", () => {
  it("should clone a public repository", async () => {
    const dir = path.join(getTempDir(), "hello-world");

    const result = await cloneRepo({ repo: TEST_REPO, dir });

    expect(result).toBe("cloned");
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
  });

  it("should skip clone if target directory already has .git", async () => {
    const dir = path.join(getTempDir(), "existing");
    fs.mkdirSync(path.join(dir, ".git"), { recursive: true });

    const result = await cloneRepo({ repo: TEST_REPO, dir });

    expect(result).toBe("skipped");
  });

  it("should report progress via callback", async () => {
    const dir = path.join(getTempDir(), "progress-test");
    const progressValues: number[] = [];

    await cloneRepo({
      repo: TEST_REPO,
      dir,
      onProgress: (p) => progressValues.push(p),
    });

    expect(progressValues.length).toBeGreaterThanOrEqual(0);
  });
});

describe("GitManager clone", () => {
  it("should clone via GitManager", async () => {
    const dir = path.join(getTempDir(), "manager-clone");
    const mgr = new GitManager(TEST_REPO, "master", dir);

    await mgr.clone();
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
  });

  it("should not throw when cloning into already-cloned directory", async () => {
    const dir = path.join(getTempDir(), "manager-skip");
    const mgr = new GitManager(TEST_REPO, "master", dir);

    await mgr.clone();
    await expect(mgr.clone()).resolves.toBeUndefined();
  });
});
