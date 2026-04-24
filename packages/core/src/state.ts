import { readFile, writeFile, rename, unlink, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createServer } from "node:net";
import type { ServiceStatus } from "./lifecycle.js";

export interface ServiceState {
  name: string;
  type: "process" | "docker";
  pid?: number;
  containerId?: string;
  status: ServiceStatus;
  startedAt?: string;
}

export interface WorkspaceState {
  version: 1;
  workspaceName: string;
  services: Record<string, ServiceState>;
  updatedAt: string;
}

const EMPTY_STATE: Omit<WorkspaceState, "updatedAt"> = {
  version: 1,
  workspaceName: "",
  services: {},
};

function getStatePath(workspaceDir: string): string {
  return resolve(workspaceDir, ".ws", "state.json");
}

function getTempPath(workspaceDir: string): string {
  return resolve(workspaceDir, ".ws", "state.json.tmp");
}

/**
 * Load workspace state from `.ws/state.json`.
 * Returns an empty state object if the file doesn't exist.
 */
export async function loadState(
  workspaceDir: string,
): Promise<WorkspaceState> {
  const statePath = getStatePath(workspaceDir);

  let raw: string;
  try {
    raw = await readFile(statePath, "utf-8");
  } catch {
    return { ...EMPTY_STATE, updatedAt: new Date().toISOString() };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(
      `[ws:state] Corrupted state file detected at ${statePath}, resetting to empty state.`,
    );
    return { ...EMPTY_STATE, updatedAt: new Date().toISOString() };
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "services" in parsed &&
    typeof (parsed as Record<string, unknown>).services === "object"
  ) {
    return parsed as WorkspaceState;
  }

  console.warn(
    `[ws:state] Malformed state file at ${statePath}, resetting to empty state.`,
  );
  return { ...EMPTY_STATE, updatedAt: new Date().toISOString() };
}

/**
 * Save workspace state to `.ws/state.json` using atomic write
 * (write to temp file, then rename) to prevent corruption.
 */
export async function saveState(
  workspaceDir: string,
  state: WorkspaceState,
): Promise<void> {
  const statePath = getStatePath(workspaceDir);
  const tempPath = getTempPath(workspaceDir);

  // Ensure .ws directory exists
  await mkdir(dirname(statePath), { recursive: true });

  const data = JSON.stringify(
    { ...state, updatedAt: new Date().toISOString() },
    null,
    2,
  );

  await writeFile(tempPath, data, "utf-8");
  try {
    await rename(tempPath, statePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV" || code === "EPERM") {
      await copyFile(tempPath, statePath);
      await unlink(tempPath).catch(() => {});
    } else {
      throw err;
    }
  }
}

/**
 * Remove stale state entries — services marked as running/ready that are
 * actually dead (zombie, orphan, or missing PID/containerId).
 * Returns the list of service names that were cleaned up.
 */
export async function fixStaleState(workspaceDir: string): Promise<string[]> {
  const state = await loadState(workspaceDir);
  const removed: string[] = [];

  for (const [name, serviceState] of Object.entries(state.services)) {
    if (serviceState.status !== "running" && serviceState.status !== "ready") {
      continue;
    }

    let isStale = false;

    if (serviceState.type === "process") {
      if (!serviceState.pid || !isPidRunning(serviceState.pid)) {
        isStale = true;
      }
    }

    if (serviceState.type === "docker") {
      if (!serviceState.containerId) {
        isStale = true;
      }
    }

    if (isStale) {
      delete state.services[name];
      removed.push(name);
    }
  }

  if (removed.length > 0) {
    if (Object.keys(state.services).length === 0) {
      await clearState(workspaceDir);
    } else {
      await saveState(workspaceDir, state);
    }
  }

  return removed;
}

/**
 * Clear workspace state (delete the state file).
 * Called when all services are stopped.
 */
export async function clearState(workspaceDir: string): Promise<void> {
  const statePath = getStatePath(workspaceDir);

  try {
    await unlink(statePath);
  } catch {
    // File doesn't exist — nothing to clear
  }
}

/**
 * Update a single service's state in the persisted state file.
 */
export async function updateServiceState(
  workspaceDir: string,
  serviceState: ServiceState,
): Promise<void> {
  const state = await loadState(workspaceDir);
  state.services[serviceState.name] = serviceState;
  await saveState(workspaceDir, state);
}

/**
 * Remove a single service's state from the persisted state file.
 */
export async function removeServiceState(
  workspaceDir: string,
  serviceName: string,
): Promise<void> {
  const state = await loadState(workspaceDir);
  delete state.services[serviceName];

  // If no services left, clear the state entirely
  if (Object.keys(state.services).length === 0) {
    await clearState(workspaceDir);
  } else {
    await saveState(workspaceDir, state);
  }
}

/**
 * Check for inconsistencies between persisted state and actual runtime.
 * Returns a list of issues found.
 */
export async function diagnoseState(
  workspaceDir: string,
  options?: {
    isProcessRunning?: (pid: number) => boolean;
    isContainerRunning?: (containerId: string) => Promise<boolean>;
  },
): Promise<StateIssue[]> {
  const state = await loadState(workspaceDir);
  const issues: StateIssue[] = [];

  for (const [name, serviceState] of Object.entries(state.services)) {
    if (serviceState.status === "running" || serviceState.status === "ready") {
      if (serviceState.type === "process" && serviceState.pid) {
        const isRunning = options?.isProcessRunning?.(serviceState.pid) ??
          isPidRunning(serviceState.pid);
        if (!isRunning) {
          issues.push({
            type: "zombie_process",
            serviceName: name,
            message: `Service "${name}" recorded as running (PID ${serviceState.pid}) but process has exited`,
            pid: serviceState.pid,
          });
        }
      }

      if (serviceState.type === "process" && !serviceState.pid) {
        issues.push({
          type: "stale_state",
          serviceName: name,
          message: `Service "${name}" recorded as running but has no PID`,
        });
      }

      if (serviceState.type === "docker" && serviceState.containerId) {
        const isRunning = options?.isContainerRunning
          ? await options.isContainerRunning(serviceState.containerId)
          : false;
        if (!isRunning) {
          issues.push({
            type: "orphan_container",
            serviceName: name,
            message: `Service "${name}" recorded as running (container ${serviceState.containerId}) but container not found`,
            containerId: serviceState.containerId,
          });
        }
      }

      if (serviceState.type === "docker" && !serviceState.containerId) {
        issues.push({
          type: "stale_state",
          serviceName: name,
          message: `Service "${name}" recorded as running but has no container ID`,
        });
      }
    }
  }

  return issues;
}

export interface StateIssue {
  type: "zombie_process" | "orphan_container" | "stale_state" | "port_conflict";
  serviceName: string;
  message: string;
  pid?: number;
  containerId?: string;
  port?: number;
}

/**
 * Check if a PID is still running (cross-platform).
 */
function isPidRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if the process exists without actually sending a signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Default implementation: test if a port is already in use by trying to listen on it.
 */
async function defaultIsPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve(true);
    });
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

/**
 * Detect port conflicts: check if any configured host port is already in use
 * by something other than our services.
 */
export async function detectPortConflicts(
  workspaceDir: string,
  services: Record<string, import("@alfroul/config").ServiceConfig>,
  options?: { isPortInUse?: (port: number) => Promise<boolean> },
): Promise<StateIssue[]> {
  const issues: StateIssue[] = [];
  const isPortInUse = options?.isPortInUse ?? defaultIsPortInUse;

  for (const [name, config] of Object.entries(services)) {
    if (config.type !== "docker" || !config.ports) {
      continue;
    }

    for (const mapping of config.ports) {
      const hostPort = parseInt(mapping.split(":")[0], 10);
      if (isNaN(hostPort)) {
        continue;
      }

      const inUse = await isPortInUse(hostPort);
      if (inUse) {
        issues.push({
          type: "port_conflict",
          serviceName: name,
          message: `Port ${hostPort} configured for service "${name}" is already in use`,
          port: hostPort,
        });
      }
    }
  }

  return issues;
}
