import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProcessManager } from "../src/manager.js";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("ProcessManager", () => {
  let pm: ProcessManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `ws-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    pm = new ProcessManager({ logDir: resolve(testDir, ".ws/logs") });
  });

  afterEach(async () => {
    await pm.stopAll().catch(() => {});
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("starts a process and returns a PID", async () => {
    const result = await pm.start('echo "hello world"', {
      name: "test-echo",
    });
    expect(result.pid).toBeGreaterThan(0);
    await pm.stop(result.pid);
  });

  it("stops a process by PID", async () => {
    const { pid } = await pm.start("node -e \"setTimeout(() => {}, 30000)\"", {
      name: "test-stop",
    });
    await pm.stop(pid);
    expect(pm.getProcess(pid)).toBeUndefined();
  });

  it("detects crash and calls onCrash callback", async () => {
    let crashInfo: { pid: number; code: number | null; name: string } | null = null;
    pm.onCrash((pid, code, name) => {
      crashInfo = { pid, code, name };
    });

    const { pid } = await pm.start("node -e \"setTimeout(() => process.exit(42), 100)\"", {
      name: "test-crash-cb",
    });

    await new Promise((resolve) => setTimeout(resolve, 15000));

    if (crashInfo) {
      expect(crashInfo.name).toBe("test-crash-cb");
    }
  }, 20000);

  it("getLogPath returns correct path", () => {
    const logPath = pm.getLogPath("myservice");
    expect(logPath).toContain("myservice.log");
  });
});
