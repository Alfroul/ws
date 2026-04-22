import type { ServiceConfig, WorkspaceConfig } from "./types.js";

export class CyclicDependencyError extends Error {
  constructor(
    public readonly cycle: string[],
  ) {
    super(`Cyclic dependency detected: ${cycle.join(" → ")}`);
    this.name = "CyclicDependencyError";
  }
}

/**
 * Detect cycles in the `depends_on` graph using DFS.
 * Returns the first cycle found as an array of service names, or null if acyclic.
 */
export function detectCycle(config: WorkspaceConfig): string[] | null {
  const services = config.services;
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const color: Record<string, number> = {};
  const parent: Record<string, string | null> = {};

  for (const name of Object.keys(services)) {
    color[name] = WHITE;
    parent[name] = null;
  }

  function dfs(name: string): string[] | null {
    color[name] = GRAY;

    const deps = (services[name] as ServiceConfig).depends_on ?? [];
    for (const dep of deps) {
      if (!(dep in color)) continue;

      if (color[dep] === GRAY) {
        const cycle = [dep];
        let current: string | null = name;
        while (current !== null && current !== dep) {
          cycle.push(current);
          current = parent[current];
        }
        cycle.push(dep);
        cycle.reverse();
        return cycle;
      }

      if (color[dep] === WHITE) {
        parent[dep] = name;
        const result = dfs(dep);
        if (result) return result;
      }
    }

    color[name] = BLACK;
    return null;
  }

  for (const name of Object.keys(services)) {
    if (color[name] === WHITE) {
      const cycle = dfs(name);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Validate that the dependency graph has no cycles.
 * Throws CyclicDependencyError with the cycle path if a cycle is found.
 */
export function validateDependencies(config: WorkspaceConfig): void {
  const cycle = detectCycle(config);
  if (cycle) {
    throw new CyclicDependencyError(cycle);
  }
}
