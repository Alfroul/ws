import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig } from "../src/parser.js";
import { validateDependencies, detectCycle, CyclicDependencyError } from "../src/validator.js";
import type { WorkspaceConfig } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../../../tests/fixtures");

describe("detectCycle", () => {
  it("returns null for config with no dependencies", () => {
    const config: WorkspaceConfig = {
      version: 1,
      name: "test",
      services: {
        a: { type: "process", start: "echo a" },
        b: { type: "docker", image: "nginx" },
      },
    };
    expect(detectCycle(config)).toBeNull();
  });

  it("returns null for linear dependency chain", () => {
    const config: WorkspaceConfig = {
      version: 1,
      name: "test",
      services: {
        a: { type: "process", start: "echo a", depends_on: ["b"] },
        b: { type: "process", start: "echo b", depends_on: ["c"] },
        c: { type: "process", start: "echo c" },
      },
    };
    expect(detectCycle(config)).toBeNull();
  });

  it("detects a simple two-node cycle", () => {
    const config: WorkspaceConfig = {
      version: 1,
      name: "test",
      services: {
        a: { type: "process", start: "echo a", depends_on: ["b"] },
        b: { type: "process", start: "echo b", depends_on: ["a"] },
      },
    };
    const cycle = detectCycle(config);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3);
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
  });

  it("detects a three-node cycle", () => {
    const config: WorkspaceConfig = {
      version: 1,
      name: "test",
      services: {
        a: { type: "process", start: "echo a", depends_on: ["c"] },
        b: { type: "process", start: "echo b", depends_on: ["a"] },
        c: { type: "process", start: "echo c", depends_on: ["b"] },
      },
    };
    const cycle = detectCycle(config);
    expect(cycle).not.toBeNull();
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
    const cycleSet = new Set(cycle);
    expect(cycleSet.has("a")).toBe(true);
    expect(cycleSet.has("b")).toBe(true);
    expect(cycleSet.has("c")).toBe(true);
  });

  it("detects cycle from fixture yaml", async () => {
    const config = await parseConfig(resolve(fixtures, "cyclic-workspace.yaml"));
    const cycle = detectCycle(config);
    expect(cycle).not.toBeNull();
    expect(cycle!.join(" → ")).toContain("a");
    expect(cycle!.join(" → ")).toContain("b");
  });
});

describe("validateDependencies", () => {
  it("does not throw for acyclic config", () => {
    const config: WorkspaceConfig = {
      version: 1,
      name: "test",
      services: {
        a: { type: "process", start: "echo a", depends_on: ["b"] },
        b: { type: "process", start: "echo b" },
      },
    };
    expect(() => validateDependencies(config)).not.toThrow();
  });

  it("throws CyclicDependencyError with cycle path for cyclic config", () => {
    const config: WorkspaceConfig = {
      version: 1,
      name: "test",
      services: {
        a: { type: "process", start: "echo a", depends_on: ["b"] },
        b: { type: "process", start: "echo b", depends_on: ["a"] },
      },
    };
    expect(() => validateDependencies(config)).toThrow(CyclicDependencyError);
    try {
      validateDependencies(config);
    } catch (err) {
      expect(err).toBeInstanceOf(CyclicDependencyError);
      const e = err as CyclicDependencyError;
      expect(e.cycle.length).toBeGreaterThanOrEqual(3);
      expect(e.message).toContain("→");
    }
  });
});
