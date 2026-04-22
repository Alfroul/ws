import type { WsPlugin } from "./types.js";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

function isWsPlugin(obj: unknown): obj is WsPlugin {
  if (typeof obj !== "object" || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return typeof candidate.name === "string" && candidate.name.length > 0;
}

/**
 * Load plugins from workspace configuration.
 *
 * Two loading strategies:
 * 1. `@alfroul/plugin-*` packages from node_modules (auto-discovery)
 * 2. Explicit paths from `config.plugins` array
 *
 * Invalid plugins are skipped with a warning — they never block the main flow.
 */
export async function loadPlugins(
  config: { plugins?: string[] },
  options?: { workspaceDir?: string },
): Promise<WsPlugin[]> {
  const plugins: WsPlugin[] = [];

  // Strategy 1: Load explicit plugin paths from config
  if (config.plugins && config.plugins.length > 0) {
    for (const pluginPath of config.plugins) {
      try {
        const plugin = await loadPluginFromPath(pluginPath, options?.workspaceDir);
        if (plugin) {
          plugins.push(plugin);
        }
      } catch (err) {
        console.warn(
          `[ws:plugin] Failed to load plugin from "${pluginPath}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  // Strategy 2: Auto-discover @alfroul/plugin-* packages from node_modules
  const discoveredPlugins = await discoverPlugins();
  for (const plugin of discoveredPlugins) {
    // Don't add duplicates
    if (!plugins.some((p) => p.name === plugin.name)) {
      plugins.push(plugin);
    }
  }

  return plugins;
}

async function loadPluginFromPath(
  pluginPath: string,
  workspaceDir?: string,
): Promise<WsPlugin | null> {
  const absolutePath = workspaceDir
    ? resolve(workspaceDir, pluginPath)
    : resolve(pluginPath);

  const fileUrl = pathToFileURL(absolutePath);

  const mod = await import(fileUrl.href);
  const plugin = mod.default ?? mod;

  if (!isWsPlugin(plugin)) {
    console.warn(
      `[ws:plugin] Plugin at "${pluginPath}" does not conform to WsPlugin interface (missing "name" string property)`,
    );
    return null;
  }

  return plugin;
}

async function discoverPlugins(): Promise<WsPlugin[]> {
  const plugins: WsPlugin[] = [];

  // Try to find @alfroul/plugin-* packages via Node's module resolution
  // We look for them by trying to require.resolve known patterns
  try {
    const { readdir } = await import("node:fs/promises");
    const { resolve: resolvePath } = await import("node:path");

    // Check node_modules in current working directory
    const nodeModulesPath = resolvePath("node_modules");
    const wsDir = resolvePath(nodeModulesPath, "@ws");

    let entries: string[];
    try {
      entries = await readdir(wsDir);
    } catch {
      // @ws scope doesn't exist in node_modules
      return plugins;
    }

    for (const entry of entries) {
      if (!entry.startsWith("plugin-")) continue;

      const pluginPkg = `@alfroul/${entry}`;
      try {
        const mod = await import(pluginPkg);
        const plugin = mod.default ?? mod;

        if (isWsPlugin(plugin)) {
          plugins.push(plugin);
        } else {
          console.warn(
            `[ws:plugin] Auto-discovered plugin "${pluginPkg}" does not conform to WsPlugin interface`,
          );
        }
      } catch (err) {
        console.warn(
          `[ws:plugin] Failed to load auto-discovered plugin "${pluginPkg}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  } catch {
    // Failed to read node_modules directory — skip auto-discovery
  }

  return plugins;
}
