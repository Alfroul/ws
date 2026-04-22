import { describe, it, expect } from "vitest";
import { topologicalSort, reverseGroups } from "../src/scheduler.js";

describe("topologicalSort", () => {
  it("returns empty array for empty services", () => {
    expect(topologicalSort({})).toEqual([]);
  });

  it("returns single group for services with no dependencies", () => {
    const services = {
      a: { type: "process" as const, start: "echo a" },
      b: { type: "process" as const, start: "echo b" },
      c: { type: "process" as const, start: "echo c" },
    };
    const result = topologicalSort(services);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("sorts linear dependencies correctly", () => {
    const services = {
      a: { type: "process" as const, start: "echo a", depends_on: ["b"] },
      b: { type: "process" as const, start: "echo b", depends_on: ["c"] },
      c: { type: "process" as const, start: "echo c" },
    };
    const result = topologicalSort(services);

    const positions = new Map(
      result.flatMap((g, i) => g.map((n) => [n, i] as const)),
    );
    expect(positions.get("c")).toBeLessThan(positions.get("b")!);
    expect(positions.get("b")).toBeLessThan(positions.get("a")!);
  });

  it("groups independent services for parallel execution", () => {
    const services = {
      a: { type: "process" as const, start: "echo a", depends_on: ["c"] },
      b: { type: "process" as const, start: "echo b", depends_on: ["c"] },
      c: { type: "process" as const, start: "echo c" },
    };
    const result = topologicalSort(services);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["c"]);
    expect(result[1]).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("throws on circular dependency", () => {
    const services = {
      a: { type: "process" as const, start: "echo a", depends_on: ["b"] },
      b: { type: "process" as const, start: "echo b", depends_on: ["c"] },
      c: { type: "process" as const, start: "echo c", depends_on: ["a"] },
    };
    expect(() => topologicalSort(services)).toThrow(/circular/i);
  });

  it("throws when depending on undefined service", () => {
    const services = {
      a: { type: "process" as const, start: "echo a", depends_on: ["missing"] },
    };
    expect(() => topologicalSort(services)).toThrow(/not defined/);
  });
});

describe("reverseGroups", () => {
  it("reverses group order", () => {
    expect(reverseGroups([["a"], ["b"], ["c"]])).toEqual([
      ["c"],
      ["b"],
      ["a"],
    ]);
  });

  it("returns empty for empty input", () => {
    expect(reverseGroups([])).toEqual([]);
  });
});
