import type { WsPlugin } from "./types.js";

type HookName = keyof Pick<
  WsPlugin,
  | "onConfigLoaded"
  | "onBeforeSetup"
  | "onServiceReady"
  | "onAllReady"
  | "onBeforeStop"
>;

export async function executeHook(
  plugins: WsPlugin[],
  hookName: HookName,
  ...args: unknown[]
): Promise<void> {
  const hooks = plugins
    .map((plugin) => {
      const hook = plugin[hookName];
      if (typeof hook !== "function") return null;
      return { name: plugin.name, hook: hook as (...a: unknown[]) => Promise<void> | void };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (hooks.length === 0) return;

  await Promise.allSettled(
    hooks.map(async ({ name, hook }) => {
      try {
        await hook(...args);
      } catch (err) {
        console.error(
          `[ws:plugin] Error in plugin "${name}" hook "${hookName}": ${err instanceof Error ? err.message : err}`,
        );
        throw err;
      }
    }),
  );
}

export const HookExecutor = {
  onConfigLoaded: (plugins: WsPlugin[], config: unknown) =>
    executeHook(plugins, "onConfigLoaded", config),

  onBeforeSetup: (plugins: WsPlugin[], config: unknown) =>
    executeHook(plugins, "onBeforeSetup", config),

  onServiceReady: (plugins: WsPlugin[], serviceName: string) =>
    executeHook(plugins, "onServiceReady", serviceName),

  onAllReady: (plugins: WsPlugin[]) =>
    executeHook(plugins, "onAllReady"),

  onBeforeStop: (plugins: WsPlugin[]) =>
    executeHook(plugins, "onBeforeStop"),
};
