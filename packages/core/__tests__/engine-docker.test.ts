import { describe, it, expect, vi, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceEngine } from "../src/engine.js";
import type { ProcessManager } from "../../process/src/index.js";
import type { DockerManager } from "../../docker/src/index.js";

function createMockProcessManager(): ProcessManager {
  return {
    start: vi.fn().mockResolvedValue({ pid: 12345 }),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue({ pid: 12346 }),
    onCrash: vi.fn(),
    stopAll: vi.fn().mockResolvedValue(undefined),
    getProcesses: vi.fn().mockReturnValue(new Map()),
    getProcess: vi.fn().mockReturnValue(undefined),
    getLogPath: vi.fn().mockReturnValue(".ws/logs/test.log"),
  } as unknown as ProcessManager;
}

function createMockDockerManager(): DockerManager {
  return {
    checkConnection: vi.fn().mockResolvedValue(undefined),
    pullImageIfNeeded: vi.fn().mockResolvedValue(undefined),
    startService: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    isServiceRunning: vi.fn().mockResolvedValue(false),
  } as unknown as DockerManager;
}

describe("WorkspaceEngine with Docker support", () => {
  let processManager: ProcessManager;
  let dockerManager: DockerManager;
  let engine: WorkspaceEngine;

  beforeEach(() => {
    processManager = createMockProcessManager();
    dockerManager = createMockDockerManager();
    engine = new WorkspaceEngine({
      processManager,
      dockerManager,
      workspaceDir: join(tmpdir(), `ws-test-docker-${Date.now()}`),
    });
  });

  describe("setup with Docker service", () => {
    it("pulls image for Docker services", async () => {
      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          redis: {
            type: "docker" as const,
            image: "redis:7",
          },
        },
      };

      await engine.setup(config);
      const status = engine.status();
      expect(status.get("redis")?.status).toBe("ready");
      expect(dockerManager.pullImageIfNeeded).toHaveBeenCalledWith("redis:7");
    });
  });

  describe("start with mixed services", () => {
    it("starts both process and docker services", async () => {
      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          api: {
            type: "process" as const,
            start: "npm start",
            depends_on: ["redis"],
          },
          redis: {
            type: "docker" as const,
            image: "redis:7",
          },
        },
      };

      await engine.start(config);
      const status = engine.status();

      expect(status.get("api")?.status).toBe("running");
      expect(status.get("redis")?.status).toBe("running");

      expect(dockerManager.startService).toHaveBeenCalledWith({
        name: "redis",
        serviceConfig: {
          type: "docker",
          image: "redis:7",
        },
        workspaceName: "test-workspace",
      });

      expect(processManager.start).toHaveBeenCalledWith(
        "npm start",
        expect.objectContaining({ name: "api" }),
      );
    });
  });

  describe("stop with mixed services", () => {
    it("stops docker services via dockerManager", async () => {
      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          redis: {
            type: "docker" as const,
            image: "redis:7",
          },
        },
      };

      await engine.start(config);
      await engine.stop();

      expect(dockerManager.stopService).toHaveBeenCalledWith("redis");
    });

    it("stops process services via processManager", async () => {
      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          web: {
            type: "process" as const,
            start: "npm start",
          },
        },
      };

      await engine.start(config);
      await engine.stop();

      expect(processManager.stop).toHaveBeenCalledWith(12345);
    });
  });

  describe("dependency ordering with Docker", () => {
    it("starts Docker services before dependent process services", async () => {
      const startOrder: string[] = [];

      (dockerManager.startService as ReturnType<typeof vi.fn>).mockImplementation(
        async (config: { name: string }) => {
          startOrder.push(`docker:${config.name}`);
        },
      );

      (processManager.start as ReturnType<typeof vi.fn>).mockImplementation(
        async (_cmd: string, opts: { name?: string }) => {
          startOrder.push(`process:${opts?.name}`);
          return { pid: 12345 };
        },
      );

      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          api: {
            type: "process" as const,
            start: "npm start",
            depends_on: ["db"],
          },
          db: {
            type: "docker" as const,
            image: "postgres:15",
          },
        },
      };

      await engine.start(config);

      expect(startOrder.indexOf("docker:db")).toBeLessThan(
        startOrder.indexOf("process:api"),
      );
    });
  });
});
