import Docker from "dockerode";
import type { DockerServiceConfig } from "../../config/src/index.js";
import {
  createContainer,
  startContainer,
  stopContainer,
  removeContainer,
} from "./container.js";
import { waitForHealthy } from "./health.js";

export class DockerManager {
  private docker: Docker;
  private containerIds = new Map<string, string>();

  constructor() {
    this.docker = new Docker();
  }

  async checkConnection(): Promise<void> {
    try {
      await this.docker.ping();
    } catch {
      throw new Error("Docker 未启动，请先启动 Docker Desktop");
    }
  }

  async pullImageIfNeeded(imageName: string): Promise<void> {
    try {
      await this.docker.getImage(imageName).inspect();
    } catch {
      const stream = await this.docker.pull(imageName);
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  async startService(config: {
    name: string;
    serviceConfig: DockerServiceConfig;
    workspaceName: string;
  }): Promise<void> {
    const { id } = await createContainer(this.docker, {
      name: config.name,
      serviceConfig: config.serviceConfig,
      workspaceName: config.workspaceName,
    });

    this.containerIds.set(config.name, id);

    await startContainer(this.docker, id);

    if (config.serviceConfig.health_check) {
      await waitForHealthy(config.name, config.serviceConfig.health_check);
    }
  }

  async stopService(name: string): Promise<void> {
    const containerId = this.containerIds.get(name);
    if (!containerId) return;

    await stopContainer(this.docker, containerId);
    await removeContainer(this.docker, containerId);
    this.containerIds.delete(name);
  }

  async isServiceRunning(name: string): Promise<boolean> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: JSON.stringify({ name: [`ws-${name}`] }),
      });
      if (containers.length === 0) return false;
      return containers[0]?.State === "running";
    } catch {
      return false;
    }
  }
}
