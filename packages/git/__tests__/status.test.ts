import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cloneRepo } from "../src/clone.js";
import { getRepoStatus } from "../src/status.js";
import { GitManager } from "../src/manager.js";

const TEST_REPO = "https://github.com/octocat/Hello-World.git";
let tempDir: string | undefined;

function getTempDir(): string {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-git-status-test-"));
  }
  return tempDir;
}

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("getRepoStatus", () => {
  it("should report not cloned for non-existent directory", async () => {
    const dir = path.join(getTempDir(), "nonexistent");

    const status = await getRepoStatus(dir);

    expect(status.cloned).toBe(false);
    expect(status.branch).toBe("");
    expect(status.dirty).toBe(false);
    expect(status.ahead).toBe(0);
  });

  it("should report cloned=true after cloning", async () => {
    const dir = path.join(getTempDir(), "cloned-repo");
    await cloneRepo({ repo: TEST_REPO, dir });

    const status = await getRepoStatus(dir);

    expect(status.cloned).toBe(true);
    expect(status.branch).toBeTruthy();
    expect(status.dirty).toBe(false);
  });

  it("should detect dirty working tree", async () => {
    const dir = path.join(getTempDir(), "dirty-repo");
    await cloneRepo({ repo: TEST_REPO, dir });

    fs.writeFileSync(path.join(dir, "new-file.txt"), "hello");

    const status = await getRepoStatus(dir);

    expect(status.dirty).toBe(true);
  });
});

describe("GitManager status", () => {
  it("should return full status via GitManager", async () => {
    const dir = path.join(getTempDir(), "mgr-status");
    const mgr = new GitManager(TEST_REPO, "master", dir);
    await mgr.clone();

    const status = await mgr.status();

    expect(status.cloned).toBe(true);
    expect(status.branch).toBeTruthy();
  });
});
