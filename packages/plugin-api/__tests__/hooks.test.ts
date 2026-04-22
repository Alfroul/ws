import { describe, it, expect, vi } from "vitest";
import { executeHook, HookExecutor } from "../src/hooks.js";
import type { WsPlugin } from "../src/types.js";

describe("executeHook", () => {
  it("does nothing when no plugins have the hook", async () => {
    const plugins: WsPlugin[] = [{ name: "empty-plugin" }];
    await executeHook(plugins, "onConfigLoaded", { version: 1, name: "test" });
  });

  it("calls the hook on all plugins that define it", async () => {
    const hook1 = vi.fn();
    const hook2 = vi.fn();

    const plugins: WsPlugin[] = [
      { name: "p1", onConfigLoaded: hook1 },
      { name: "p2", onConfigLoaded: hook2 },
    ];

    await executeHook(plugins, "onConfigLoaded", { version: 1, name: "test" });

    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  it("calls hooks in parallel (not sequentially)", async () => {
    const order: string[] = [];

    const plugins: WsPlugin[] = [
      {
        name: "slow",
        onServiceReady: async () => {
          await new Promise((r) => setTimeout(r, 50));
          order.push("slow");
        },
      },
      {
        name: "fast",
        onServiceReady: async () => {
          order.push("fast");
        },
      },
    ];

    await executeHook(plugins, "onServiceReady", "test-svc");

    expect(order).toContain("fast");
    expect(order).toContain("slow");
  });

  it("does not block other plugins when one throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const goodHook = vi.fn();

    const plugins: WsPlugin[] = [
      {
        name: "bad",
        onAllReady: async () => {
          throw new Error("boom");
        },
      },
      {
        name: "good",
        onAllReady: goodHook,
      },
    ];

    await executeHook(plugins, "onAllReady");

    expect(goodHook).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("calls onServiceReady with service name", async () => {
    const hook = vi.fn();
    const plugins: WsPlugin[] = [{ name: "p1", onServiceReady: hook }];

    await executeHook(plugins, "onServiceReady", "my-service");

    expect(hook).toHaveBeenCalledWith("my-service");
  });
});

describe("HookExecutor", () => {
  it("calls onConfigLoaded with config", async () => {
    const hook = vi.fn();
    const plugins: WsPlugin[] = [{ name: "p1", onConfigLoaded: hook }];
    const config = { version: 1, name: "test" };

    await HookExecutor.onConfigLoaded(plugins, config);

    expect(hook).toHaveBeenCalledWith(config);
  });

  it("calls onBeforeStop with no args", async () => {
    const hook = vi.fn();
    const plugins: WsPlugin[] = [{ name: "p1", onBeforeStop: hook }];

    await HookExecutor.onBeforeStop(plugins);

    expect(hook).toHaveBeenCalledWith();
  });
});
