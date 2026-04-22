import { describe, it, expect, beforeAll } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

let dockerAvailable = false;

async function checkDocker(): Promise<boolean> {
  try {
    const { default: Docker } = await import("dockerode");
    const docker = new Docker();
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  dockerAvailable = await checkDocker();
});

describe("waitForHealthy", () => {
  it("returns immediately when no config provided", async () => {
    const { waitForHealthy } = await import("../src/health.js");
    await expect(waitForHealthy("test")).resolves.toBeUndefined();
  });

  it("succeeds for HTTP health check when server responds 200", async () => {
    const { waitForHealthy } = await import("../src/health.js");

    const server = createServer((req, res) => {
      res.writeHead(200);
      res.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    try {
      await waitForHealthy("test-service", {
        type: "http",
        url: `http://127.0.0.1:${port}/health`,
        interval: 100,
        timeout: 3000,
      });
    } finally {
      server.close();
    }
  });

  it("succeeds for TCP health check when port is open", async () => {
    const { waitForHealthy } = await import("../src/health.js");

    const server = createServer(() => {});
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    try {
      await waitForHealthy("test-service", {
        type: "tcp",
        port,
        interval: 100,
        timeout: 3000,
      });
    } finally {
      server.close();
    }
  });

  it("throws on timeout when HTTP server is not available", async () => {
    const { waitForHealthy } = await import("../src/health.js");

    await expect(
      waitForHealthy("test-service", {
        type: "http",
        url: "http://127.0.0.1:1/nonexistent",
        interval: 50,
        timeout: 200,
      }),
    ).rejects.toThrow("服务 test-service 在 200ms 内未就绪");
  });

  it("throws on timeout when TCP port is not open", async () => {
    const { waitForHealthy } = await import("../src/health.js");

    await expect(
      waitForHealthy("test-service", {
        type: "tcp",
        port: 1,
        interval: 50,
        timeout: 200,
      }),
    ).rejects.toThrow("服务 test-service 在 200ms 内未就绪");
  });
});
