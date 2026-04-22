import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadState, saveState, clearState, updateServiceState, removeServiceState, diagnoseState } from "../src/state.js";
import type { WorkspaceState } from "../src/state.js";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("State Store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = resolve(tmpdir(), `ws-test-state-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loadState", () => {
    it("returns empty state when no state file exists", async () => {
      const state = await loadState(tempDir);
      expect(state.version).toBe(1);
      expect(state.services).toEqual({});
    });

    it("loads state from existing file", async () => {
      const wsDir = resolve(tempDir, ".ws");
      await mkdir(wsDir, { recursive: true });
      const state: WorkspaceState = {
        version: 1,
        workspaceName: "test",
        services: {
          api: { name: "api", type: "process", pid: 1234, status: "running" },
        },
        updatedAt: new Date().toISOString(),
      };
      await require("node:fs/promises").writeFile(
        resolve(wsDir, "state.json"),
        JSON.stringify(state),
        "utf-8",
      );

      const loaded = await loadState(tempDir);
      expect(loaded.workspaceName).toBe("test");
      expect(loaded.services.api.pid).toBe(1234);
    });
  });

  describe("saveState", () => {
    it("creates .ws directory and writes state", async () => {
      const state: WorkspaceState = {
        version: 1,
        workspaceName: "test",
        services: {},
        updatedAt: new Date().toISOString(),
      };

      await saveState(tempDir, state);

      const raw = await readFile(resolve(tempDir, ".ws", "state.json"), "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(1);
      expect(parsed.workspaceName).toBe("test");
    });

    it("overwrites updatedAt timestamp", async () => {
      const state: WorkspaceState = {
        version: 1,
        workspaceName: "test",
        services: {},
        updatedAt: "2020-01-01T00:00:00.000Z",
      };

      await saveState(tempDir, state);

      const raw = await readFile(resolve(tempDir, ".ws", "state.json"), "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
    });

    it("performs atomic write (temp file then rename)", async () => {
      const state: WorkspaceState = {
        version: 1,
        workspaceName: "test",
        services: {},
        updatedAt: new Date().toISOString(),
      };

      await saveState(tempDir, state);

      const tempPath = resolve(tempDir, ".ws", "state.json.tmp");
      await expect(stat(tempPath)).rejects.toThrow();
    });
  });

  describe("clearState", () => {
    it("deletes state file", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {},
        updatedAt: new Date().toISOString(),
      });

      await clearState(tempDir);

      const state = await loadState(tempDir);
      expect(state.services).toEqual({});
    });

    it("does not throw when state file does not exist", async () => {
      await expect(clearState(tempDir)).resolves.toBeUndefined();
    });
  });

  describe("updateServiceState", () => {
    it("adds a service to state", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {},
        updatedAt: new Date().toISOString(),
      });

      await updateServiceState(tempDir, {
        name: "api",
        type: "process",
        pid: 1234,
        status: "running",
      });

      const state = await loadState(tempDir);
      expect(state.services.api).toBeDefined();
      expect(state.services.api.pid).toBe(1234);
    });

    it("updates existing service state", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {
          api: { name: "api", type: "process", pid: 1234, status: "running" },
        },
        updatedAt: new Date().toISOString(),
      });

      await updateServiceState(tempDir, {
        name: "api",
        type: "process",
        pid: 1234,
        status: "stopped",
      });

      const state = await loadState(tempDir);
      expect(state.services.api.status).toBe("stopped");
    });
  });

  describe("removeServiceState", () => {
    it("removes a service from state", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {
          api: { name: "api", type: "process", status: "running" },
          db: { name: "db", type: "docker", status: "running" },
        },
        updatedAt: new Date().toISOString(),
      });

      await removeServiceState(tempDir, "api");

      const state = await loadState(tempDir);
      expect(state.services.api).toBeUndefined();
      expect(state.services.db).toBeDefined();
    });

    it("clears entire state when last service removed", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {
          api: { name: "api", type: "process", status: "running" },
        },
        updatedAt: new Date().toISOString(),
      });

      await removeServiceState(tempDir, "api");

      const state = await loadState(tempDir);
      expect(state.services).toEqual({});
    });
  });

  describe("diagnoseState", () => {
    it("reports no issues for clean state", async () => {
      const issues = await diagnoseState(tempDir);
      expect(issues).toEqual([]);
    });

    it("detects zombie process (running but PID dead)", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {
          api: { name: "api", type: "process", pid: 99999999, status: "running" },
        },
        updatedAt: new Date().toISOString(),
      });

      const issues = await diagnoseState(tempDir);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("zombie_process");
      expect(issues[0].serviceName).toBe("api");
    });

    it("uses custom isProcessRunning checker", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {
          api: { name: "api", type: "process", pid: 1234, status: "running" },
        },
        updatedAt: new Date().toISOString(),
      });

      const issues = await diagnoseState(tempDir, {
        isProcessRunning: () => true,
      });

      expect(issues).toHaveLength(0);
    });

    it("detects orphan container", async () => {
      await saveState(tempDir, {
        version: 1,
        workspaceName: "test",
        services: {
          redis: {
            name: "redis",
            type: "docker",
            containerId: "abc123",
            status: "running",
          },
        },
        updatedAt: new Date().toISOString(),
      });

      const issues = await diagnoseState(tempDir, {
        isContainerRunning: async () => false,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("orphan_container");
      expect(issues[0].serviceName).toBe("redis");
    });
  });
});
