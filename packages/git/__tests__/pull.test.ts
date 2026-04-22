import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cloneRepo } from "../src/clone.js";
import { pullRepo, isDirty } from "../src/pull.js";
import { GitManager } from "../src/manager.js";

const TEST_REPO = "https://github.com/octocat/Hello-World.git";
let tempDir: string | undefined;

function getTempDir(): string {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-git-pull-test-"));
  }
  return tempDir;
}

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("pullRepo", () => {
  it("should report alreadyUpToDate on freshly cloned repo", async () => {
    const dir = path.join(getTempDir(), "fresh-clone");
    await cloneRepo({ repo: TEST_REPO, dir });

    const result = await pullRepo({ dir, ref: "master" });

    expect(result.alreadyUpToDate).toBe(true);
  });

  it("should throw when working tree has uncommitted changes", async () => {
    const dir = path.join(getTempDir(), "dirty-pull");
    await cloneRepo({ repo: TEST_REPO, dir });

    fs.writeFileSync(path.join(dir, "uncommitted.txt"), "dirty");

    await expect(pullRepo({ dir, ref: "master" })).rejects.toThrow(
      "uncommitted changes",
    );
  });
});

describe("isDirty", () => {
  it("should return false for clean repo", async () => {
    const dir = path.join(getTempDir(), "clean-dirty");
    await cloneRepo({ repo: TEST_REPO, dir });

    expect(await isDirty(dir)).toBe(false);
  });

  it("should return true when new file is added", async () => {
    const dir = path.join(getTempDir(), "dirty-dirty");
    await cloneRepo({ repo: TEST_REPO, dir });

    fs.writeFileSync(path.join(dir, "added.txt"), "content");

    expect(await isDirty(dir)).toBe(true);
  });
});

describe("GitManager pull", () => {
  it("should pull via GitManager", async () => {
    const dir = path.join(getTempDir(), "mgr-pull");
    const mgr = new GitManager(TEST_REPO, "master", dir);
    await mgr.clone();

    await expect(mgr.pull()).resolves.toBeUndefined();
  });

  it("should throw on pull with dirty tree", async () => {
    const dir = path.join(getTempDir(), "mgr-pull-dirty");
    const mgr = new GitManager(TEST_REPO, "master", dir);
    await mgr.clone();

    fs.writeFileSync(path.join(dir, "dirty.txt"), "changes");

    await expect(mgr.pull()).rejects.toThrow("uncommitted changes");
  });
});
