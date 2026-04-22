import { describe, it, expect, vi } from "vitest";
import { createNotificationsPlugin, notificationsPlugin } from "../src/index.js";

describe("notificationsPlugin", () => {
  it("has correct name", () => {
    expect(notificationsPlugin.name).toBe("@ws/plugin-notifications");
  });

  it("exports createNotificationsPlugin factory", () => {
    const plugin = createNotificationsPlugin({ enabled: true, sound: false });
    expect(plugin.name).toBe("@ws/plugin-notifications");
    expect(plugin.onServiceReady).toBeTypeOf("function");
    expect(plugin.onAllReady).toBeTypeOf("function");
    expect(plugin.onBeforeStop).toBeTypeOf("function");
  });

  it("logs on service ready", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = createNotificationsPlugin();
    await plugin.onServiceReady!("test-service");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("test-service"));
    spy.mockRestore();
  });

  it("logs on all ready", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = createNotificationsPlugin();
    await plugin.onAllReady!();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("All services are ready"));
    spy.mockRestore();
  });

  it("logs on before stop", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = createNotificationsPlugin();
    await plugin.onBeforeStop!();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Stopping"));
    spy.mockRestore();
  });

  it("does not log when disabled", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const plugin = createNotificationsPlugin({ enabled: false });
    await plugin.onServiceReady!("test-service");
    await plugin.onAllReady!();
    await plugin.onBeforeStop!();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
