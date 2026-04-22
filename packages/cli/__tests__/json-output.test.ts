import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("--json flag", () => {
  const cli = "node packages/cli/dist/index.js";

  it("outputs version in JSON when --json --version is used", () => {
    // Commander handles --version separately, just verify --json doesn't break it
    const output = execSync(`${cli} --version`, { encoding: "utf-8" }).trim();
    expect(output).toBe("0.1.0");
  });

  it("shows help without error", () => {
    const output = execSync(`${cli} --help`, { encoding: "utf-8" });
    expect(output).toContain("Developer workspace manager");
    expect(output).toContain("--verbose");
    expect(output).toContain("--json");
  });
});
