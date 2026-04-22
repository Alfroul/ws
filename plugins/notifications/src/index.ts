import type { WsPlugin, PluginWorkspaceConfig } from "@alfroul/plugin-api";

/** Configuration for the notifications plugin. */
export interface NotificationsConfig {
  /** Whether notifications are enabled. @default true */
  enabled?: boolean;
  /** Whether to play a sound. Placeholder for future use. @default false */
  sound?: boolean;
}

/** Default configuration values. */
const DEFAULT_CONFIG: Required<NotificationsConfig> = {
  enabled: true,
  sound: false,
};

/** Safely resolve chalk — returns plain-text fallback if unavailable. */
async function getChalk() {
  try {
    const mod = await import("chalk");
    return mod.default ?? mod;
  } catch {
    return {
      green: (s: string) => s,
      cyan: (s: string) => s,
      yellow: (s: string) => s,
      red: (s: string) => s,
    };
  }
}

/**
 * Create a notifications plugin with optional configuration.
 *
 * @param config - Optional configuration overrides.
 * @returns A {@link WsPlugin} that logs workspace lifecycle events.
 */
export function createNotificationsPlugin(
  config?: NotificationsConfig,
): WsPlugin {
  const cfg: Required<NotificationsConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let workspaceName = "workspace";

  return {
    name: "@alfroul/plugin-notifications",

    onConfigLoaded(config: PluginWorkspaceConfig) {
      workspaceName = config.name ?? "workspace";
    },

    async onServiceReady(serviceName: string) {
      if (!cfg.enabled) return;
      const chalk = await getChalk();
      console.log(chalk.cyan(`● Service '${serviceName}' is ready`));
    },

    async onAllReady() {
      if (!cfg.enabled) return;
      const chalk = await getChalk();
      console.log(
        chalk.green(
          `✓ All services are ready! Workspace '${workspaceName}' is up and running.`,
        ),
      );
    },

    async onBeforeStop() {
      if (!cfg.enabled) return;
      const chalk = await getChalk();
      console.log(chalk.yellow("Stopping services..."));
    },
  };
}

/** Default notifications plugin instance (enabled: true, sound: false). */
export const notificationsPlugin: WsPlugin = createNotificationsPlugin();

export default notificationsPlugin;
