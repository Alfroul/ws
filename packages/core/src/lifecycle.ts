import type { ServiceConfig } from "../../config/src/index.js";

export type ServiceStatus =
  | "pending"
  | "setting_up"
  | "ready"
  | "running"
  | "stopping"
  | "stopped"
  | "crashed";

export interface ServiceInstance {
  name: string;
  config: ServiceConfig;
  status: ServiceStatus;
  pid?: number;
  restartCount: number;
  startedAt?: Date;
}

/**
 * Valid state transitions map.
 * Key = current status, Value = set of allowed target statuses.
 */
const VALID_TRANSITIONS: Record<ServiceStatus, Set<ServiceStatus>> = {
  pending: new Set(["setting_up"]),
  setting_up: new Set(["ready", "crashed"]),
  ready: new Set(["running", "crashed"]),
  running: new Set(["stopping", "crashed"]),
  stopping: new Set(["stopped", "crashed"]),
  stopped: new Set(["pending"]),
  crashed: new Set(["pending"]),
};

export function canTransition(
  from: ServiceStatus,
  to: ServiceStatus,
): boolean {
  return VALID_TRANSITIONS[from].has(to);
}

export function transition(
  instance: ServiceInstance,
  to: ServiceStatus,
): void {
  if (!canTransition(instance.status, to)) {
    throw new Error(
      `Invalid state transition: ${instance.status} → ${to} for service "${instance.name}"`,
    );
  }
  instance.status = to;
}

export type ServiceLifecycle = ServiceStatus;
