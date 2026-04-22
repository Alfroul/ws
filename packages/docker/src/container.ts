import Docker from "dockerode";
import type { DockerServiceConfig } from "../../config/src/index.js";

export interface ContainerCreateResult {
  id: string;
  name: string;
}

/**
 * Parse port mapping strings like ["8080:80", "443:443"]
 * into Docker API's ExposedPorts and PortBindings format.
 */
function parsePortBindings(ports: string[]): {
  ExposedPorts: Record<string, {}>;
  PortBindings: Record<string, Array<{ HostPort: string }>>;
} {
  const ExposedPorts: Record<string, {}> = {};
  const PortBindings: Record<string, Array<{ HostPort: string }>> = {};

  for (const portMapping of ports) {
    const [hostPort, containerPort] = portMapping.split(":");
    const containerPortWithProto = `${containerPort}/tcp`;
    ExposedPorts[containerPortWithProto] = {};
    PortBindings[containerPortWithProto] = [{ HostPort: hostPort }];
  }

  return { ExposedPorts, PortBindings };
}

/**
 * Convert env record { KEY: "VALUE" } to Docker Env array ["KEY=VALUE"].
 */
function envToArray(env?: Record<string, string>): string[] | undefined {
  if (!env) return undefined;
  return Object.entries(env).map(([key, value]) => `${key}=${value}`);
}

/**
 * Create a Docker container from a service config.
 * Container name follows convention: ws-{workspaceName}-{serviceName}
 */
export async function createContainer(
  docker: Docker,
  config: {
    name: string;
    serviceConfig: DockerServiceConfig;
    workspaceName: string;
  },
): Promise<ContainerCreateResult> {
  const { name, serviceConfig, workspaceName } = config;
  const containerName = `ws-${workspaceName}-${name}`;

  const createOptions: Docker.ContainerCreateOptions = {
    name: containerName,
    Image: serviceConfig.image,
    Env: envToArray(serviceConfig.env),
    Labels: {
      "ws.workspace": workspaceName,
      "ws.service": name,
    },
  };

  if (serviceConfig.ports && serviceConfig.ports.length > 0) {
    const { ExposedPorts, PortBindings } = parsePortBindings(
      serviceConfig.ports,
    );
    createOptions.ExposedPorts = ExposedPorts;
    createOptions.HostConfig = { PortBindings };
  }

  const container = await docker.createContainer(createOptions);
  return { id: container.id, name: containerName };
}

/**
 * Start a Docker container by ID.
 */
export async function startContainer(
  docker: Docker,
  containerId: string,
): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

/**
 * Stop a Docker container gracefully.
 * Waits up to `timeoutSeconds` before force-killing.
 */
export async function stopContainer(
  docker: Docker,
  containerId: string,
  timeoutSeconds = 10,
): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: timeoutSeconds });
  } catch (err) {
    // Container may already be stopped — ignore "not running" errors
    if (err instanceof Error && !err.message.includes("not running")) {
      throw err;
    }
  }
}

/**
 * Remove a Docker container.
 */
export async function removeContainer(
  docker: Docker,
  containerId: string,
): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.remove({ force: false });
  } catch (err) {
    // Container may already be removed
    if (err instanceof Error && !err.message.includes("No such container")) {
      throw err;
    }
  }
}
