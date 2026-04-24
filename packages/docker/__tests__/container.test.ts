import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

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

describe("DockerManager", () => {
  describe.skipIf(() => !dockerAvailable)("checkConnection", () => {
    it("succeeds when Docker is running", async () => {
      const { DockerManager } = await import("../src/manager.js");
      const manager = new DockerManager();
      await expect(manager.checkConnection()).resolves.toBeUndefined();
    });
  });

  describe("checkConnection (mocked)", () => {
    it("throws friendly error when Docker is not running", async () => {
      const { DockerManager } = await import("../src/manager.js");
      const manager = new DockerManager();
      vi.spyOn(manager["docker"], "ping").mockRejectedValue(
        new Error("connect EACCES"),
      );

      await expect(manager.checkConnection()).rejects.toThrow(
        "Docker is not running",
      );

      vi.restoreAllMocks();
    });
  });

  describe.skipIf(() => !dockerAvailable)("container lifecycle", () => {
    let manager: import("../src/manager.js").DockerManager;

    afterEach(async () => {
      try {
        await manager?.stopService("test-container");
      } catch {}
    });

    it("starts and stops a container", async () => {
      const { DockerManager } = await import("../src/manager.js");
      manager = new DockerManager();
      const serviceName = `test-${Date.now()}`;
      await manager.startService({
        name: serviceName,
        serviceConfig: {
          type: "docker",
          image: "hello-world",
        },
        workspaceName: "test-ws",
      });

      const running = await manager.isServiceRunning(serviceName);
      expect(running).toBe(true);

      await manager.stopService(serviceName);

      const runningAfter = await manager.isServiceRunning(serviceName);
      expect(runningAfter).toBe(false);
    });
  });

  describe.skipIf(() => !dockerAvailable)("isServiceRunning", () => {
    it("returns false for non-existent service", async () => {
      const { DockerManager } = await import("../src/manager.js");
      const manager = new DockerManager();
      const result = await manager.isServiceRunning("non-existent-service");
      expect(result).toBe(false);
    });
  });
});

describe("port binding conversion", () => {
  it("parses port mapping strings into Docker format", () => {
    const ports = ["8080:80", "443:443"];
    const ExposedPorts: Record<string, {}> = {};
    const PortBindings: Record<string, Array<{ HostPort: string }>> = {};

    for (const portMapping of ports) {
      const [hostPort, containerPort] = portMapping.split(":");
      const key = `${containerPort}/tcp`;
      ExposedPorts[key] = {};
      PortBindings[key] = [{ HostPort: hostPort }];
    }

    expect(ExposedPorts).toEqual({ "80/tcp": {}, "443/tcp": {} });
    expect(PortBindings).toEqual({
      "80/tcp": [{ HostPort: "8080" }],
      "443/tcp": [{ HostPort: "443" }],
    });
  });
});
