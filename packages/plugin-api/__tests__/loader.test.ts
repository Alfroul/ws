import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadPlugins } from "../src/loader.js";
import type { WsPlugin } from "../src/types.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const TEST_TMP_BASE = resolve(process.cwd(), ".test-tmp");

describe("loadPlugins", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = resolve(TEST_TMP_BASE, `plugins-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no plugins configured", async () => {
    const plugins = await loadPlugins({}, { workspaceDir: tempDir });
    expect(plugins).toEqual([]);
  });

  it("returns empty array when plugins array is empty", async () => {
    const plugins = await loadPlugins({ plugins: [] }, { workspaceDir: tempDir });
    expect(plugins).toEqual([]);
  });

  it("loads a valid plugin from file path", async () => {
    const pluginCode = `
      export default {
        name: "test-plugin",
        onConfigLoaded: async () => {},
        onServiceReady: async () => {},
      };
    `;
    const pluginPath = resolve(tempDir, "test-plugin.js");
    await writeFile(pluginPath, pluginCode, "utf-8");

    const plugins = await loadPlugins(
      { plugins: ["./test-plugin.js"] },
      { workspaceDir: tempDir },
    );

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("test-plugin");
  });

  it("skips invalid plugin (missing name) with warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pluginCode = `export default { onConfigLoaded: async () => {} };`;
    const pluginPath = resolve(tempDir, "bad-plugin.js");
    await writeFile(pluginPath, pluginCode, "utf-8");

    const plugins = await loadPlugins(
      { plugins: ["./bad-plugin.js"] },
      { workspaceDir: tempDir },
    );

    expect(plugins).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("skips plugin that fails to load with warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const plugins = await loadPlugins(
      { plugins: ["./nonexistent-plugin.js"] },
      { workspaceDir: tempDir },
    );

    expect(plugins).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("loads multiple plugins in order", async () => {
    const plugin1Code = `export default { name: "plugin-1" };`;
    const plugin2Code = `export default { name: "plugin-2" };`;
    await writeFile(resolve(tempDir, "p1.js"), plugin1Code, "utf-8");
    await writeFile(resolve(tempDir, "p2.js"), plugin2Code, "utf-8");

    const plugins = await loadPlugins(
      { plugins: ["./p1.js", "./p2.js"] },
      { workspaceDir: tempDir },
    );

    expect(plugins).toHaveLength(2);
    expect(plugins[0].name).toBe("plugin-1");
    expect(plugins[1].name).toBe("plugin-2");
  });
});
