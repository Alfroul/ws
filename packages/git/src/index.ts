export { GitManager, type RepoStatus } from "./manager.js";
export { cloneRepo, type CloneOptions } from "./clone.js";
export { pullRepo, isDirty, type PullOptions, type PullResult } from "./pull.js";
export { getRepoStatus, type RepoStatus as RepoStatusDetail } from "./status.js";
