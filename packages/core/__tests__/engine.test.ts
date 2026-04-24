import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspaceEngine } from "../src/engine.js";
import type { ProcessManager } from "../../process/src/index.js";

const mockSpawn = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

function createMockChildProcess() {
  return {
    on(event: string, handler: Function) {
      if (event === "exit") setTimeout(() => handler(0), 0);
    },
  };
}

function createMockProcessManager(): ProcessManager {
  return {
    start: vi.fn().mockResolvedValue({ pid: 12345 }),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue({ pid: 12346 }),
    onCrash: vi.fn(),
    onRestart: vi.fn(),
    onMaxRestartsReached: vi.fn(),
    stopAll: vi.fn().mockResolvedValue(undefined),
    getProcesses: vi.fn().mockReturnValue(new Map()),
    getProcess: vi.fn().mockReturnValue(undefined),
    getLogPath: vi.fn().mockReturnValue(".ws/logs/test.log"),
  } as unknown as ProcessManager;
}

describe("WorkspaceEngine", () => {
  let processManager: ProcessManager;
  let engine: WorkspaceEngine;

  beforeEach(() => {
    mockSpawn.mockReturnValue(createMockChildProcess());
    processManager = createMockProcessManager();
    engine = new WorkspaceEngine({
      processManager,
      workspaceDir: "/tmp/test-workspace",
    });
  });

  describe("setup", () => {
    it("sets up process services with setup commands", async () => {
      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          web: {
            type: "process" as const,
            setup: "npm install",
            start: "npm start",
          },
        },
      };

      await engine.setup(config);
      const status = engine.status();
      expect(status.get("web")?.status).toBe("ready");
      expect(mockSpawn).toHaveBeenCalled();
    });

    it("sets up services with dependencies in order", async () => {
      const setupOrder: string[] = [];
      mockSpawn.mockImplementation((cmd: string, args: string[]) => {
        const command = args.length > 1 ? args.slice(1).join(" ") : cmd;
        setupOrder.push(command);
        return createMockChildProcess();
      });

      const config = {
        version: 1 as const,
        name: "test-workspace",
        services: {
          api: {
            type: "process" as const,
            setup: "npm install api",
            start: "npm start api",
            depends_on: ["db"],
          },
          db: {
            type: "process" as const,
            setup: "npm install db",
            start: "npm start db",
          },
        },
      };

      await engine.setup(config);
      expect(setupOrder.findIndex((c) => c.includes("install db"))).toBeLessThan(
        setupOrder.findIndex((c) => c.includes("install api")),
      );
    });
  });

  describe("start", () => {
    it("starts services and marks them running", async () => {
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
      const status = engine.status();
      expect(status.get("web")?.status).toBe("running");
      expect(status.get("web")?.pid).toBe(12345);
    });
  });

  describe("stop", () => {
    it("stops running services", async () => {
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
      const status = engine.status();
      expect(status.get("web")?.status).toBe("stopped");
    });
  });

  describe("status", () => {
    it("returns empty map when no services configured", () => {
      expect(engine.status().size).toBe(0);
    });
  });
});
