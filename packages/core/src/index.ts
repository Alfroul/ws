export { WorkspaceEngine, type EngineOptions, type GitManagerLike } from "./engine.js";
export { topologicalSort, reverseGroups } from "./scheduler.js";
export type {
  ServiceStatus,
  ServiceInstance,
  ServiceLifecycle,
} from "./lifecycle.js";
export { canTransition, transition } from "./lifecycle.js";
export { EventBus, type EventMap, type EventHandler } from "./events.js";
export {
  loadState,
  saveState,
  clearState,
  updateServiceState,
  removeServiceState,
  diagnoseState,
  detectPortConflicts,
  fixStaleState,
  type WorkspaceState,
  type ServiceState,
  type StateIssue,
} from "./state.js";
