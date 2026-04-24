import { describe, it, expect, vi } from "vitest";
import { WorkspaceEngine } from "../src/engine.js";
import type { WsPlugin } from "../../plugin-api/src/types.js";
import type { WorkspaceConfig } from "../../config/src/index.js";

function createMockProcessManager() {
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
  };
}

function createTestConfig(): WorkspaceConfig {
  return {
    version: 1,
    name: "test-workspace",
    services: {
      api: {
        type: "process",
        start: "node server.js",
        workdir: "api",
      },
    },
  };
}

describe("Engine Plugin Integration", () => {
  it("calls onConfigLoaded during setup", async () => {
    const onConfigLoaded = vi.fn();
    const plugin: WsPlugin = { name: "test-plugin", onConfigLoaded };

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    const config = createTestConfig();
    await engine.setup(config);

    expect(onConfigLoaded).toHaveBeenCalledTimes(1);
  });

  it("calls onBeforeSetup during setup", async () => {
    const onBeforeSetup = vi.fn();
    const plugin: WsPlugin = { name: "test-plugin", onBeforeSetup };

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    const config = createTestConfig();
    await engine.setup(config);

    expect(onBeforeSetup).toHaveBeenCalledTimes(1);
  });

  it("calls onServiceReady when each service becomes ready", async () => {
    const onServiceReady = vi.fn();
    const plugin: WsPlugin = { name: "test-plugin", onServiceReady };

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    const config = createTestConfig();
    await engine.setup(config);

    expect(onServiceReady).toHaveBeenCalledWith("api");
  });

  it("calls onAllReady after all services are ready", async () => {
    const onAllReady = vi.fn();
    const plugin: WsPlugin = { name: "test-plugin", onAllReady };

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    const config = createTestConfig();
    await engine.setup(config);

    expect(onAllReady).toHaveBeenCalledTimes(1);
  });

  it("calls onAllReady after start completes", async () => {
    const onAllReady = vi.fn();
    const plugin: WsPlugin = { name: "test-plugin", onAllReady };

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    const config = createTestConfig();
    await engine.start(config);

    expect(onAllReady).toHaveBeenCalledTimes(1);
  });

  it("calls onBeforeStop during stop", async () => {
    const onBeforeStop = vi.fn();
    const plugin: WsPlugin = { name: "test-plugin", onBeforeStop };

    const pm = createMockProcessManager();
    const engine = new WorkspaceEngine({
      processManager: pm as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    const config = createTestConfig();
    await engine.start(config);
    await engine.stop();

    expect(onBeforeStop).toHaveBeenCalledTimes(1);
  });

  it("does not crash when plugin hook throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const goodHook = vi.fn();

    const badPlugin: WsPlugin = {
      name: "bad-plugin",
      onConfigLoaded: async () => {
        throw new Error("plugin error");
      },
    };
    const goodPlugin: WsPlugin = {
      name: "good-plugin",
      onConfigLoaded: goodHook,
    };

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([badPlugin, goodPlugin]);

    const config = createTestConfig();
    await engine.setup(config);

    expect(goodHook).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("calls hooks on multiple plugins", async () => {
    const hook1 = vi.fn();
    const hook2 = vi.fn();

    const plugins: WsPlugin[] = [
      { name: "p1", onConfigLoaded: hook1 },
      { name: "p2", onConfigLoaded: hook2 },
    ];

    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins(plugins);

    const config = createTestConfig();
    await engine.setup(config);

    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  it("returns plugins via getPlugins", () => {
    const plugin: WsPlugin = { name: "test" };
    const engine = new WorkspaceEngine({
      processManager: createMockProcessManager() as unknown as Parameters<typeof WorkspaceEngine>[0]["processManager"],
      workspaceDir: "/tmp/test",
    });
    engine.setPlugins([plugin]);

    expect(engine.getPlugins()).toHaveLength(1);
    expect(engine.getPlugins()[0].name).toBe("test");
  });
});
