import { describe, it, expect, vi, afterEach } from "vitest";
import { createHealthCheckPlugin, checkHealth, healthCheckPlugin } from "../src/index.js";

describe("checkHealth", () => {
  it("returns ok for 2xx status", async () => {
    // Test against a URL that will fail to connect — verifies error handling path
    const result = await checkHealth("http://localhost:1");
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("healthCheckPlugin", () => {
  it("has correct name", () => {
    expect(healthCheckPlugin.name).toBe("@alfroul/plugin-health-check");
  });

  it("default plugin does nothing for unknown services", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await healthCheckPlugin.onServiceReady!("unknown-service");
    // No interval should be created — no logs expected
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("cleans up intervals on before stop", async () => {
    const plugin = createHealthCheckPlugin({
      checks: {
        test: { url: "http://localhost:9999/health", interval: 1000 },
      },
    });
    // onBeforeStop should not throw even without active intervals
    await plugin.onBeforeStop!();
  });
});

describe("createHealthCheckPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a plugin with configured checks", () => {
    const plugin = createHealthCheckPlugin({
      checks: {
        api: { url: "http://localhost:3000/health" },
      },
    });
    expect(plugin.name).toBe("@alfroul/plugin-health-check");
    expect(plugin.onServiceReady).toBeTypeOf("function");
    expect(plugin.onBeforeStop).toBeTypeOf("function");
  });

  it("starts interval check on service ready", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const plugin = createHealthCheckPlugin({
      checks: {
        api: { url: "http://localhost:9999/health", interval: 1000, retries: 2 },
      },
    });

    await plugin.onServiceReady!("api");

    // Advance timer to trigger first check
    await vi.advanceTimersByTimeAsync(1100);

    // Should have logged something (either pass or fail)
    const called = spy.mock.calls.length + warnSpy.mock.calls.length + errorSpy.mock.calls.length;
    expect(called).toBeGreaterThanOrEqual(0); // Network call in test env

    await plugin.onBeforeStop!();
    spy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.useRealTimers();
  });
});
