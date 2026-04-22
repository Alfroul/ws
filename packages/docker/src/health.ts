import { createConnection } from "node:net";

export interface HealthCheckConfig {
  type: "http" | "tcp";
  url?: string;
  port?: number;
  interval?: number;
  timeout?: number;
}

const DEFAULT_INTERVAL = 5000;
const DEFAULT_TIMEOUT = 30000;

async function checkHttp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

function checkTcp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(port, "127.0.0.1", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function waitForHealthy(
  serviceName: string,
  config?: HealthCheckConfig,
): Promise<void> {
  if (!config) return;

  const interval = config.interval ?? DEFAULT_INTERVAL;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    let healthy = false;

    if (config.type === "http" && config.url) {
      healthy = await checkHttp(config.url);
    } else if (config.type === "tcp" && config.port) {
      healthy = await checkTcp(config.port);
    }

    if (healthy) return;

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`服务 ${serviceName} 在 ${timeout}ms 内未就绪`);
}
