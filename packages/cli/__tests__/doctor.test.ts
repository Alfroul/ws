import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  diagnoseState,
  detectPortConflicts,
  fixStaleState,
  saveState,
} from "../../core/src/state.js";
import type { WorkspaceState } from "../../core/src/state.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = resolve(tmpdir(), `ws-test-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(resolve(tmpDir, ".ws"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function createTestState(
  services: Record<string, unknown>,
): void {
  const state: WorkspaceState = {
    version: 1,
    workspaceName: "test",
    services: services as WorkspaceState["services"],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(
    resolve(tmpDir, ".ws", "state.json"),
    JSON.stringify(state, null, 2),
  );
}

describe("diagnoseState", () => {
  it("detects stale process state with no PID", async () => {
    createTestState({
      api: { name: "api", type: "process", status: "running" },
    });

    const issues = await diagnoseState(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("stale_state");
    expect(issues[0].serviceName).toBe("api");
  });

  it("detects stale docker state with no containerId", async () => {
    createTestState({
      redis: { name: "redis", type: "docker", status: "running" },
    });

    const issues = await diagnoseState(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("stale_state");
    expect(issues[0].serviceName).toBe("redis");
  });

  it("does not flag stopped services", async () => {
    createTestState({
      api: { name: "api", type: "process", status: "stopped" },
      redis: { name: "redis", type: "docker", status: "stopped" },
    });

    const issues = await diagnoseState(tmpDir);
    expect(issues).toEqual([]);
  });

  it("detects zombie process", async () => {
    createTestState({
      api: {
        name: "api",
        type: "process",
        pid: 999999999,
        status: "running",
      },
    });

    const issues = await diagnoseState(tmpDir);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("zombie_process");
    expect(issues[0].serviceName).toBe("api");
    expect(issues[0].pid).toBe(999999999);
  });
});

describe("detectPortConflicts", () => {
  it("detects port conflict when port is in use", async () => {
    const issues = await detectPortConflicts(
      tmpDir,
      {
        redis: {
          type: "docker",
          image: "redis:7",
          ports: ["6379:6379"],
        },
      },
      { isPortInUse: async () => true },
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("port_conflict");
    expect(issues[0].serviceName).toBe("redis");
    expect(issues[0].port).toBe(6379);
  });

  it("returns no issues when port is free", async () => {
    const issues = await detectPortConflicts(
      tmpDir,
      {
        redis: {
          type: "docker",
          image: "redis:7",
          ports: ["6379:6379"],
        },
      },
      { isPortInUse: async () => false },
    );

    expect(issues).toEqual([]);
  });

  it("skips non-docker services", async () => {
    const issues = await detectPortConflicts(
      tmpDir,
      {
        api: {
          type: "process",
          start: "npm start",
        },
      },
      { isPortInUse: async () => true },
    );

    expect(issues).toEqual([]);
  });

  it("handles invalid port mapping gracefully", async () => {
    const issues = await detectPortConflicts(
      tmpDir,
      {
        redis: {
          type: "docker",
          image: "redis:7",
          ports: ["abc:80"],
        },
      },
      { isPortInUse: async () => true },
    );

    expect(issues).toEqual([]);
  });
});

describe("fixStaleState", () => {
  it("removes stale entries and returns their names", async () => {
    await saveState(tmpDir, {
      version: 1,
      workspaceName: "test",
      services: {
        api: { name: "api", type: "process", status: "running" },
        redis: { name: "redis", type: "docker", status: "stopped" },
      },
      updatedAt: new Date().toISOString(),
    });

    const removed = await fixStaleState(tmpDir);
    expect(removed).toEqual(["api"]);

    const statePath = resolve(tmpDir, ".ws", "state.json");
    expect(existsSync(statePath)).toBe(true);
  });

  it("returns empty array when no stale entries", async () => {
    await saveState(tmpDir, {
      version: 1,
      workspaceName: "test",
      services: {
        api: { name: "api", type: "process", status: "stopped" },
        redis: { name: "redis", type: "docker", status: "stopped" },
      },
      updatedAt: new Date().toISOString(),
    });

    const removed = await fixStaleState(tmpDir);
    expect(removed).toEqual([]);
  });

  it("clears state file when all services are stale", async () => {
    await saveState(tmpDir, {
      version: 1,
      workspaceName: "test",
      services: {
        api: { name: "api", type: "process", status: "running" },
        redis: { name: "redis", type: "docker", status: "running" },
      },
      updatedAt: new Date().toISOString(),
    });

    const removed = await fixStaleState(tmpDir);
    expect(removed.sort()).toEqual(["api", "redis"]);

    const statePath = resolve(tmpDir, ".ws", "state.json");
    expect(existsSync(statePath)).toBe(false);
  });
});
