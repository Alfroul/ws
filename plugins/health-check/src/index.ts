import type { WsPlugin } from "@alfroul/plugin-api";

export interface HealthCheckConfig {
  checks: Record<
    string,
    {
      url: string;
      interval?: number;
      retries?: number;
    }
  >;
}

export interface HealthCheckResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Perform a single HTTP GET health check against the given URL.
 * Returns ok=true for any 2xx status code.
 */
export async function checkHealth(url: string): Promise<HealthCheckResult> {
  try {
    const response = await fetch(url, { method: "GET" });
    if (response.ok) {
      return { ok: true, status: response.status };
    }
    return { ok: false, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Factory that creates a WsPlugin with the given health check configuration.
 */
export function createHealthCheckPlugin(config: HealthCheckConfig): WsPlugin {
  const activeIntervals = new Map<string, NodeJS.Timeout>();
  const failureCounters = new Map<string, number>();

  const checks = config.checks;

  return {
    name: "@alfroul/plugin-health-check",

    async onServiceReady(serviceName: string): Promise<void> {
      const check = checks[serviceName];
      if (!check) return;

      const interval = check.interval ?? 5000;
      const retries = check.retries ?? 3;

      if (activeIntervals.has(serviceName)) return;

      failureCounters.set(serviceName, 0);

      const timer = setInterval(async () => {
        const result = await checkHealth(check.url);

        if (result.ok) {
          failureCounters.set(serviceName, 0);
          console.log(`✓ Service '${serviceName}' health check passed`);
        } else {
          const failures = (failureCounters.get(serviceName) ?? 0) + 1;
          failureCounters.set(serviceName, failures);

          if (failures < retries) {
            console.warn(
              `⚠ Service '${serviceName}' health check failed (attempt ${failures}/${retries})` +
                (result.error ? `: ${result.error}` : ` — status ${result.status}`)
            );
          } else {
            console.error(
              `✗ Service '${serviceName}' is unhealthy (failed ${failures} consecutive checks)`
            );
          }
        }
      }, interval);

      activeIntervals.set(serviceName, timer);
    },

    async onBeforeStop(): Promise<void> {
      for (const [name, timer] of activeIntervals) {
        clearInterval(timer);
        activeIntervals.delete(name);
      }
      failureCounters.clear();
    },
  };
}

/**
 * Default instance with no configured checks.
 * Usable as-is but does nothing until replaced with a configured instance.
 */
export const healthCheckPlugin: WsPlugin = createHealthCheckPlugin({ checks: {} });

export default healthCheckPlugin;
