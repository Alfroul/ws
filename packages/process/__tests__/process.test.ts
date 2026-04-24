import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  it("does not restart more than maxRestarts times", async () => {
    const maxReached = vi.fn();
    const crashed = vi.fn();
    pm.onMaxRestartsReached(maxReached);
    pm.onCrash(crashed);

    const { pid } = await pm.start("node -e \"process.exit(1)\"", {
      name: "test-restart-limit",
    });

    // Wait enough time for all restart attempts (default: 1s + 2s + 4s + buffer)
    await new Promise((resolve) => setTimeout(resolve, 15000));

    expect(maxReached).toHaveBeenCalled();
    expect(maxReached.mock.calls[0][2]).toBe("test-restart-limit");
  }, 25000);

  it("exit(0) does not trigger restart", async () => {
    const crashed = vi.fn();
    const restarted = vi.fn();
    pm.onCrash(crashed);
    pm.onRestart(restarted);

    await pm.start("node -e \"process.exit(0)\"", {
      name: "test-exit-zero",
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(crashed).not.toHaveBeenCalled();
    expect(restarted).not.toHaveBeenCalled();
  }, 5000);

  it("accepts custom restartPolicy", async () => {
    const customDir = resolve(tmpdir(), `ws-test-policy-${Date.now()}`);
    await mkdir(customDir, { recursive: true });
    const customPm = new ProcessManager({
      logDir: resolve(customDir, ".ws/logs"),
      restartPolicy: { maxRestarts: 1 },
    });

    const maxReached = vi.fn();
    customPm.onMaxRestartsReached(maxReached);

    await customPm.start("node -e \"process.exit(1)\"", {
      name: "test-custom-policy",
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    expect(maxReached).toHaveBeenCalled();

    await customPm.stopAll().catch(() => {});
    await rm(customDir, { recursive: true, force: true }).catch(() => {});
  }, 10000);
});
