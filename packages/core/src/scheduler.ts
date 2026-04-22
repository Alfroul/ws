import type { ServiceConfig } from "../../config/src/index.js";

/**
 * Topological sort of services by their `depends_on` relationships.
 * Returns groups of service names that can be started in parallel.
 *
 * Uses Kahn's algorithm (BFS-based).
 *
 * @param services - Map of service name → ServiceConfig
 * @returns Array of groups (string[][]). Group 0 = no deps, Group N = deps in earlier groups.
 * @throws Error if circular dependency detected
 */
export function topologicalSort(
  services: Record<string, ServiceConfig>,
): string[][] {
  const names = Object.keys(services);
  if (names.length === 0) return [];

  // Build adjacency: dependency → dependents (who depends on me)
  const dependents = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const name of names) {
    dependents.set(name, new Set());
    inDegree.set(name, 0);
  }

  for (const name of names) {
    const deps = services[name].depends_on ?? [];
    inDegree.set(name, deps.length);
    for (const dep of deps) {
      if (!dependents.has(dep)) {
        throw new Error(
          `Service "${name}" depends on "${dep}", but "${dep}" is not defined`,
        );
      }
      dependents.get(dep)!.add(name);
    }
  }

  const groups: string[][] = [];

  // Start with nodes that have no dependencies
  let queue = names.filter((n) => inDegree.get(n) === 0);

  while (queue.length > 0) {
    groups.push([...queue]);
    const nextQueue: string[] = [];

    for (const name of queue) {
      for (const dependent of dependents.get(name)!) {
        const newDegree = inDegree.get(dependent)! - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          nextQueue.push(dependent);
        }
      }
    }

    queue = nextQueue;
  }

  // Check for cycle: if not all nodes processed, there's a cycle
  const processed = groups.reduce((sum, g) => sum + g.length, 0);
  if (processed < names.length) {
    const remaining = names.filter((n) => !groups.flat().includes(n));
    throw new Error(
      `Circular dependency detected among: ${remaining.join(" → ")}`,
    );
  }

  return groups;
}

/**
 * Returns the stop order: reverse of start order, preserving parallel groups.
 */
export function reverseGroups(groups: string[][]): string[][] {
  return [...groups].reverse();
}
